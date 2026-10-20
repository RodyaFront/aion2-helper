using System.Text.Json;
using AionDPS.Aion2;
using AionDPS.Aion2.Capture;
using AionDPS.Aion2.Protocol;
using AionDPS.Combat;
using AionDPS.Combat.Sources;

namespace BossKillWatcher;

/// <summary>
/// Death-only Npcap sidecar for Aion Boss Tracker.
/// Adapted from SkeeveAN/Aion-DPS-Meter (MIT) — see NOTICE.md / NOTICE-SkeeveAN.txt.
/// Stdout: one JSON object per line.
/// </summary>
internal static class Program
{
    private static readonly JsonSerializerOptions JsonOpts = new() { PropertyNamingPolicy = JsonNamingPolicy.CamelCase };

    /// <summary>Verteron + Altgard field-boss NPC ids (same as whitelist.json / BossDef.npcIds).</summary>
    private static readonly int[] DefaultWhitelist =
    [
        2100003, 2100040, 2100050, 2100076, 2100077, 2100079, 2100141, 2100177, 2100178,
        2100582, 2100617, 2100661, 2100708, 2100718, 2100876, 2100877, 2100988, 2100989,
        2100991, 2101016, 2101074, 2101120, 2101122, 2101131,
        2400017, 2400074, 2400140, 2400141, 2400212, 2400223, 2400274, 2400335, 2400353,
        2400358, 2400419, 2400424, 2400425, 2400474, 2400504, 2400593, 2400607, 2400608,
        2400659, 2400709, 2400800, 2400853, 2400854, 2400855,
    ];

    private static int Main(string[] args)
    {
        // Vendored protocol code resolves assets via AppContext.BaseDirectory — keep cwd/exe aligned.
        try
        {
            string exeDir = Path.GetDirectoryName(Environment.ProcessPath) ?? AppContext.BaseDirectory;
            Directory.SetCurrentDirectory(exeDir);
        }
        catch
        {
            // ignore
        }

        string mode = args.Length > 0 ? args[0].Trim().ToLowerInvariant() : "watch";
        return mode switch
        {
            "detect" or "--detect" => RunDetect(),
            "watch" or "--watch" => RunWatch(),
            "help" or "--help" or "-h" => PrintHelp(),
            _ => Fail($"unknown mode: {mode}"),
        };
    }

    private static int PrintHelp()
    {
        Console.Error.WriteLine("boss-kill-watcher detect|watch");
        Console.Error.WriteLine("  detect  — check Npcap install (JSON on stdout)");
        Console.Error.WriteLine("  watch   — capture game traffic; emit {\"npcId\":…,\"at\":…} on each known field-boss death");
        return 0;
    }

    private static int RunDetect()
    {
        NpcapAvailability npcap = NpcapAvailability.Detect();
        Write(new
        {
            ok = npcap.IsInstalled,
            status = npcap.IsInstalled ? "ok" : "missing",
            location = npcap.Location,
            downloadUrl = NpcapAvailability.DownloadUrl,
        });
        return npcap.IsInstalled ? 0 : 2;
    }

    private static int RunWatch()
    {
        NpcapAvailability npcap = NpcapAvailability.Detect();
        if (!npcap.IsInstalled)
        {
            Write(new { type = "status", status = "missing_npcap", message = "Npcap is not installed", downloadUrl = NpcapAvailability.DownloadUrl });
            return 2;
        }

        HashSet<int> whitelist = LoadWhitelist();
        string opcodesPath = Path.Combine(AppContext.BaseDirectory, "assets", "aion2", "protocol", "opcodes.json");
        Aion2Protocol protocol = Aion2Protocol.Load(opcodesPath);
        if (!protocol.IsCalibrated)
        {
            Write(new
            {
                type = "status",
                status = "error",
                message = $"protocol opcodes not calibrated ({opcodesPath}; exists={File.Exists(opcodesPath)})",
            });
            return 4;
        }

        using var source = new Aion2PacketCombatSource(protocol);
        var entities = (Aion2EntityDirectory)source.Entities;
        var seen = new HashSet<(int Entity, long Tick)>();
        // Packet timestamps are local (SharpPcap Timeval → ToLocalTime). Must poll with DateTime.Now,
        // not UtcNow — otherwise deaths fall outside the window (e.g. UTC+3).
        DateTime cursor = DateTime.Now.AddMinutes(-1);

        // Field-boss list (opcode 01 91): deaths on value change; timer sync when the tab is (re)opened.
        var fieldAlive = new Dictionary<int, bool>();
        DateTime lastFieldListAt = DateTime.MinValue;
        const double fieldListReopenGapSec = 2.5;

        void EmitFieldDeaths()
        {
            try
            {
                DateTime now = DateTime.Now;
                foreach (FieldBossMap map in Aion2FieldBosses.Maps)
                {
                    foreach (FieldBoss boss in map.Bosses)
                    {
                        if (!whitelist.Contains(boss.Npc))
                        {
                            continue;
                        }

                        BossPhase phase = Aion2FieldBosses.StatusOf(boss, now).Phase;
                        if (phase is BossPhase.Unknown or BossPhase.Fixed)
                        {
                            continue;
                        }

                        bool alive = phase == BossPhase.Now;
                        if (fieldAlive.TryGetValue(boss.Npc, out bool wasAlive) && wasAlive && !alive)
                        {
                            long dedupe = now.Ticks / TimeSpan.TicksPerSecond;
                            if (seen.Add((-boss.Npc, dedupe)))
                            {
                                Write(new
                                {
                                    type = "death",
                                    npcId = boss.Npc,
                                    entityId = 0,
                                    at = new DateTimeOffset(now).ToUnixTimeMilliseconds(),
                                    source = "field_list",
                                });
                            }
                        }

                        fieldAlive[boss.Npc] = alive;
                    }
                }
            }
            catch (Exception ex)
            {
                Console.Error.WriteLine($"field-boss deaths: {ex.Message}");
            }
        }

        void EmitFieldSyncIfReopen()
        {
            try
            {
                DateTime now = DateTime.Now;
                // While the tab stays open the game may re-send the same list often.
                // Only offer sync after a quiet gap (closed the tab / left Exploration).
                bool reopen = lastFieldListAt == DateTime.MinValue
                    || (now - lastFieldListAt).TotalSeconds >= fieldListReopenGapSec;
                lastFieldListAt = now;
                if (!reopen)
                {
                    return;
                }

                var syncBosses = new List<object>();
                foreach (FieldBossMap map in Aion2FieldBosses.Maps)
                {
                    foreach (FieldBoss boss in map.Bosses)
                    {
                        if (!whitelist.Contains(boss.Npc))
                        {
                            continue;
                        }

                        BossStatus status = Aion2FieldBosses.StatusOf(boss, now);
                        BossPhase phase = status.Phase;
                        if (phase is BossPhase.Unknown or BossPhase.Fixed)
                        {
                            continue;
                        }

                        if (status.SeenAt is not { } seenAt || (now - seenAt).TotalSeconds > 5)
                        {
                            continue;
                        }

                        long? respawnAt = null;
                        if (phase == BossPhase.Respawn && status.At is { } back)
                        {
                            respawnAt = new DateTimeOffset(back).ToUnixTimeMilliseconds();
                        }

                        syncBosses.Add(new
                        {
                            npcId = boss.Npc,
                            alive = phase == BossPhase.Now,
                            respawnAt,
                        });
                    }
                }

                if (syncBosses.Count > 0)
                {
                    Write(new
                    {
                        type = "field_sync",
                        at = new DateTimeOffset(now).ToUnixTimeMilliseconds(),
                        bosses = syncBosses,
                    });
                }
            }
            catch (Exception ex)
            {
                Console.Error.WriteLine($"field-boss sync: {ex.Message}");
            }
        }

        Aion2FieldBosses.Changed += EmitFieldDeaths;
        Aion2FieldBosses.ListReceived += EmitFieldSyncIfReopen;

        source.StatusChanged += status =>
        {
            Write(new { type = "status", status = status.State.ToString().ToLowerInvariant(), message = status.Message });
        };

        source.Start();
        Write(new { type = "status", status = "listening", message = "Npcap capture started", whitelist = whitelist.Count });

        using var cts = new CancellationTokenSource();
        Console.CancelKeyPress += (_, e) =>
        {
            e.Cancel = true;
            cts.Cancel();
        };

        try
        {
            while (!cts.IsCancellationRequested)
            {
                _ = source.Poll(paused: false);
                DateTime now = DateTime.Now;
                List<DeathRecord> deaths = entities.Combat.DeathsIn(cursor, now);
                foreach (DeathRecord death in deaths)
                {
                    long tick = death.At.Ticks;
                    if (!seen.Add((death.Entity, tick)))
                    {
                        continue;
                    }

                    int? npcId = entities.NpcIdOf(death.Entity) ?? entities.BossNpcIdOf(death.Entity);
                    if (npcId is not int id || !whitelist.Contains(id))
                    {
                        continue;
                    }

                    Write(new
                    {
                        type = "death",
                        npcId = id,
                        entityId = death.Entity,
                        at = new DateTimeOffset(death.At).ToUnixTimeMilliseconds(),
                        source = "hp",
                    });
                }

                cursor = now.AddSeconds(-2);
                if (seen.Count > 500)
                {
                    seen.Clear();
                }

                Thread.Sleep(250);
            }
        }
        finally
        {
            source.Stop();
            Write(new { type = "status", status = "stopped", message = "capture stopped" });
        }

        return 0;
    }

    private static HashSet<int> LoadWhitelist()
    {
        var ids = new HashSet<int>(DefaultWhitelist);
        string path = Path.Combine(AppContext.BaseDirectory, "whitelist.json");
        if (!File.Exists(path))
        {
            return ids;
        }

        try
        {
            using JsonDocument doc = JsonDocument.Parse(File.ReadAllText(path));
            if (doc.RootElement.TryGetProperty("npcIds", out JsonElement arr))
            {
                var fromFile = new HashSet<int>();
                foreach (JsonElement el in arr.EnumerateArray())
                {
                    if (el.TryGetInt32(out int id))
                    {
                        fromFile.Add(id);
                    }
                }

                if (fromFile.Count > 0)
                {
                    return fromFile;
                }
            }
        }
        catch (Exception ex) when (ex is IOException or JsonException)
        {
            Console.Error.WriteLine($"whitelist: {ex.Message}");
        }

        return ids;
    }

    private static void Write(object payload)
    {
        Console.WriteLine(JsonSerializer.Serialize(payload, JsonOpts));
        Console.Out.Flush();
    }

    private static int Fail(string message)
    {
        Write(new { type = "status", status = "error", message });
        return 1;
    }
}
