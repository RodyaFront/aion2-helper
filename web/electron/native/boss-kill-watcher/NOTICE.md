# Third-party notice — boss-kill-watcher

Packet capture and Aion 2 frame decoding under `vendor/` are adapted from
[SkeeveAN/Aion-DPS-Meter](https://github.com/SkeeveAN/Aion-DPS-Meter) (`Client/`),
licensed under the MIT License. Full upstream license text: `NOTICE-SkeeveAN.txt`.

This sidecar is death-detection only (no DPS meter UI, overlay, or uploads).
It reads game network traffic passively via Npcap and does not modify the game client.
