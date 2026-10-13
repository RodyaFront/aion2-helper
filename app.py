"""AION 2 Verteron field-boss tracker for Windows."""

from __future__ import annotations

import re
import time
import tkinter as tk
from tkinter import messagebox, simpledialog, ttk
from uuid import uuid4
from winsound import Beep, MessageBeep, MB_ICONEXCLAMATION

from bosses import VERTERON_BOSSES, format_interval
from storage import BossState, bosses_from_payload, load_state, save_state

ALERT_THRESHOLDS = (15, 10, 5)
TICK_MS = 1000


def sync_missed_alerts(boss: BossState, now: float | None = None) -> bool:
    """Mark thresholds already behind us as fired without notifying."""
    if boss.respawn_at is None:
        return False
    now = time.time() if now is None else now
    remaining_min = (boss.respawn_at - now) / 60.0
    changed = False
    for threshold in ALERT_THRESHOLDS:
        if remaining_min < threshold and threshold not in boss.fired_alerts:
            boss.fired_alerts.append(threshold)
            changed = True
    return changed


def format_countdown(seconds: float) -> str:
    if seconds <= 0:
        return "Готов"
    total = int(seconds)
    hours, rem = divmod(total, 3600)
    minutes, secs = divmod(rem, 60)
    if hours:
        return f"{hours:d}:{minutes:02d}:{secs:02d}"
    return f"{minutes:02d}:{secs:02d}"


def slugify(name: str) -> str:
    base = re.sub(r"[^a-z0-9]+", "_", name.lower()).strip("_")
    return base or "boss"


class BossTrackerApp(tk.Tk):
    def __init__(self) -> None:
        super().__init__()
        self.title("AION 2 — трекер боссов (Verteron / Lamuatan)")
        self.geometry("780x720")
        self.minsize(640, 480)
        self.configure(bg="#1a1d24")

        self.bosses: list[BossState] = []
        self.card_frames: dict[str, ttk.Frame] = {}
        self.countdown_labels: dict[str, ttk.Label] = {}
        self.status_labels: dict[str, ttk.Label] = {}

        self._build_style()
        self._build_chrome()
        self._load_or_seed()
        self._render_cards()
        self.after(TICK_MS, self._tick)
        self.protocol("WM_DELETE_WINDOW", self._on_close)

    def _build_style(self) -> None:
        style = ttk.Style(self)
        try:
            style.theme_use("clam")
        except tk.TclError:
            pass
        style.configure("Root.TFrame", background="#1a1d24")
        style.configure("Card.TFrame", background="#252a33", relief="flat")
        style.configure("Title.TLabel", background="#1a1d24", foreground="#f0f2f5", font=("Segoe UI", 14, "bold"))
        style.configure("Muted.TLabel", background="#1a1d24", foreground="#9aa3b2", font=("Segoe UI", 9))
        style.configure("CardName.TLabel", background="#252a33", foreground="#f0f2f5", font=("Segoe UI", 11, "bold"))
        style.configure("CardMeta.TLabel", background="#252a33", foreground="#9aa3b2", font=("Segoe UI", 9))
        style.configure("Countdown.TLabel", background="#252a33", foreground="#7dd3a8", font=("Consolas", 16, "bold"))
        style.configure("Idle.TLabel", background="#252a33", foreground="#6b7280", font=("Consolas", 16, "bold"))
        style.configure("Ready.TLabel", background="#252a33", foreground="#fbbf24", font=("Consolas", 16, "bold"))
        style.configure("Toolbar.TButton", font=("Segoe UI", 9))

    def _build_chrome(self) -> None:
        top = ttk.Frame(self, style="Root.TFrame", padding=(16, 12, 16, 8))
        top.pack(fill="x")
        ttk.Label(top, text="Полевые боссы Вертерона", style="Title.TLabel").pack(side="left")
        ttk.Button(top, text="Добавить босса", style="Toolbar.TButton", command=self._add_custom_boss).pack(
            side="right", padx=(8, 0)
        )
        ttk.Label(
            top,
            text="Таймер от убийства. Оповещение за 15 / 10 / 5 мин.",
            style="Muted.TLabel",
        ).pack(side="right", padx=(0, 12))

        canvas_host = ttk.Frame(self, style="Root.TFrame")
        canvas_host.pack(fill="both", expand=True, padx=12, pady=(0, 12))

        self.canvas = tk.Canvas(canvas_host, bg="#1a1d24", highlightthickness=0, bd=0)
        scrollbar = ttk.Scrollbar(canvas_host, orient="vertical", command=self.canvas.yview)
        self.list_frame = ttk.Frame(self.canvas, style="Root.TFrame")
        self.list_frame.bind(
            "<Configure>",
            lambda _e: self.canvas.configure(scrollregion=self.canvas.bbox("all")),
        )
        self._list_window = self.canvas.create_window((0, 0), window=self.list_frame, anchor="nw")
        self.canvas.configure(yscrollcommand=scrollbar.set)
        self.canvas.pack(side="left", fill="both", expand=True)
        scrollbar.pack(side="right", fill="y")
        self.canvas.bind("<Configure>", self._on_canvas_configure)
        self.canvas.bind_all("<MouseWheel>", self._on_mousewheel)

    def _on_canvas_configure(self, event: tk.Event) -> None:
        self.canvas.itemconfigure(self._list_window, width=event.width)

    def _on_mousewheel(self, event: tk.Event) -> None:
        self.canvas.yview_scroll(int(-event.delta / 120), "units")

    def _load_or_seed(self) -> None:
        saved = bosses_from_payload(load_state())
        if saved:
            self.bosses = saved
            now = time.time()
            if any(sync_missed_alerts(b, now) for b in self.bosses):
                self._persist()
            return
        self.bosses = [
            BossState(
                id=b.id,
                name=b.name,
                location=b.location,
                respawn_minutes=b.respawn_minutes,
                custom=False,
            )
            for b in VERTERON_BOSSES
        ]
        self._persist()

    def _persist(self) -> None:
        save_state(self.bosses)

    def _sorted_bosses(self) -> list[BossState]:
        now = time.time()

        def key(b: BossState) -> tuple:
            if b.respawn_at is None:
                return (2, b.respawn_minutes, b.name.lower())
            remaining = b.respawn_at - now
            if remaining <= 0:
                return (0, remaining, b.name.lower())
            return (1, remaining, b.name.lower())

        return sorted(self.bosses, key=key)

    def _clear_cards(self) -> None:
        for child in self.list_frame.winfo_children():
            child.destroy()
        self.card_frames.clear()
        self.countdown_labels.clear()
        self.status_labels.clear()

    def _render_cards(self) -> None:
        self._clear_cards()
        for boss in self._sorted_bosses():
            self._build_card(boss)
        self._refresh_countdowns()

    def _build_card(self, boss: BossState) -> None:
        card = ttk.Frame(self.list_frame, style="Card.TFrame", padding=12)
        card.pack(fill="x", pady=6, padx=4)

        left = ttk.Frame(card, style="Card.TFrame")
        left.pack(side="left", fill="both", expand=True)
        ttk.Label(left, text=boss.name, style="CardName.TLabel").pack(anchor="w")
        meta = f"{boss.location}  ·  интервал {format_interval(boss.respawn_minutes)}"
        if boss.custom:
            meta += "  ·  свой"
        status = ttk.Label(left, text=meta, style="CardMeta.TLabel")
        status.pack(anchor="w", pady=(2, 0))
        self.status_labels[boss.id] = status

        right = ttk.Frame(card, style="Card.TFrame")
        right.pack(side="right")
        countdown = ttk.Label(right, text="—", style="Idle.TLabel")
        countdown.pack(anchor="e")
        self.countdown_labels[boss.id] = countdown

        buttons = ttk.Frame(card, style="Card.TFrame")
        buttons.pack(fill="x", pady=(10, 0))
        ttk.Button(
            buttons,
            text="Только что убит",
            command=lambda b=boss.id: self._mark_killed(b),
        ).pack(side="left")
        ttk.Button(
            buttons,
            text="Своё время",
            command=lambda b=boss.id: self._set_custom_remaining(b),
        ).pack(side="left", padx=(8, 0))
        ttk.Button(
            buttons,
            text="Интервал",
            command=lambda b=boss.id: self._edit_interval(b),
        ).pack(side="left", padx=(8, 0))
        ttk.Button(
            buttons,
            text="Сбросить",
            command=lambda b=boss.id: self._clear_timer(b),
        ).pack(side="left", padx=(8, 0))
        if boss.custom:
            ttk.Button(
                buttons,
                text="Удалить",
                command=lambda b=boss.id: self._delete_boss(b),
            ).pack(side="right")

        self.card_frames[boss.id] = card

    def _find(self, boss_id: str) -> BossState | None:
        for boss in self.bosses:
            if boss.id == boss_id:
                return boss
        return None

    def _mark_killed(self, boss_id: str) -> None:
        boss = self._find(boss_id)
        if not boss:
            return
        now = time.time()
        boss.respawn_at = now + boss.respawn_minutes * 60
        boss.fired_alerts = []
        self._persist()
        self._render_cards()

    def _set_custom_remaining(self, boss_id: str) -> None:
        boss = self._find(boss_id)
        if not boss:
            return
        minutes = simpledialog.askfloat(
            "Своё время",
            f"Сколько минут осталось до респауна «{boss.name}»?",
            parent=self,
            minvalue=0.1,
            maxvalue=24 * 60,
        )
        if minutes is None:
            return
        now = time.time()
        boss.respawn_at = now + minutes * 60
        boss.fired_alerts = []
        sync_missed_alerts(boss, now)
        self._persist()
        self._render_cards()

    def _edit_interval(self, boss_id: str) -> None:
        boss = self._find(boss_id)
        if not boss:
            return
        value = simpledialog.askinteger(
            "Интервал",
            f"Интервал респауна «{boss.name}» в минутах:",
            parent=self,
            initialvalue=boss.respawn_minutes,
            minvalue=1,
            maxvalue=24 * 60,
        )
        if value is None:
            return
        boss.respawn_minutes = value
        self._persist()
        self._render_cards()

    def _clear_timer(self, boss_id: str) -> None:
        boss = self._find(boss_id)
        if not boss:
            return
        boss.respawn_at = None
        boss.fired_alerts = []
        self._persist()
        self._render_cards()

    def _delete_boss(self, boss_id: str) -> None:
        boss = self._find(boss_id)
        if not boss or not boss.custom:
            return
        if not messagebox.askyesno("Удалить", f"Удалить «{boss.name}»?", parent=self):
            return
        self.bosses = [b for b in self.bosses if b.id != boss_id]
        self._persist()
        self._render_cards()

    def _add_custom_boss(self) -> None:
        name = simpledialog.askstring("Новый босс", "Название босса:", parent=self)
        if not name or not name.strip():
            return
        location = simpledialog.askstring("Новый босс", "Место (необязательно):", parent=self) or ""
        minutes = simpledialog.askinteger(
            "Новый босс",
            "Интервал респауна в минутах:",
            parent=self,
            minvalue=1,
            maxvalue=24 * 60,
            initialvalue=60,
        )
        if minutes is None:
            return
        boss_id = f"custom_{slugify(name)}_{uuid4().hex[:8]}"
        self.bosses.append(
            BossState(
                id=boss_id,
                name=name.strip(),
                location=location.strip(),
                respawn_minutes=minutes,
                custom=True,
            )
        )
        self._persist()
        self._render_cards()

    def _refresh_countdowns(self) -> None:
        now = time.time()
        for boss in self.bosses:
            label = self.countdown_labels.get(boss.id)
            if not label:
                continue
            if boss.respawn_at is None:
                label.configure(text="—", style="Idle.TLabel")
                continue
            remaining = boss.respawn_at - now
            text = format_countdown(remaining)
            style = "Ready.TLabel" if remaining <= 0 else "Countdown.TLabel"
            label.configure(text=text, style=style)

    def _tick(self) -> None:
        now = time.time()
        order_before = [b.id for b in self._sorted_bosses()]
        alerts: list[tuple[BossState, int]] = []

        for boss in self.bosses:
            if boss.respawn_at is None:
                continue
            remaining_sec = boss.respawn_at - now
            remaining_min = remaining_sec / 60.0
            for threshold in ALERT_THRESHOLDS:
                if threshold in boss.fired_alerts:
                    continue
                # Fire when we cross into or are at the threshold window from above.
                if remaining_min <= threshold and remaining_sec > 0:
                    boss.fired_alerts.append(threshold)
                    alerts.append((boss, threshold))

        if alerts:
            self._persist()
            for boss, threshold in alerts:
                self._notify(boss, threshold)

        order_after = [b.id for b in self._sorted_bosses()]
        if order_before != order_after:
            self._render_cards()
        else:
            self._refresh_countdowns()

        self.after(TICK_MS, self._tick)

    def _notify(self, boss: BossState, minutes: int) -> None:
        try:
            Beep(880, 180)
            Beep(1175, 220)
        except RuntimeError:
            MessageBeep(MB_ICONEXCLAMATION)

        popup = tk.Toplevel(self)
        popup.title("Респаун скоро")
        popup.attributes("-topmost", True)
        popup.configure(bg="#252a33")
        popup.geometry("360x140")
        popup.resizable(False, False)
        tk.Label(
            popup,
            text=boss.name,
            bg="#252a33",
            fg="#f0f2f5",
            font=("Segoe UI", 12, "bold"),
        ).pack(pady=(20, 6), padx=16)
        tk.Label(
            popup,
            text=f"Возродится через {minutes} мин",
            bg="#252a33",
            fg="#9aa3b2",
            font=("Segoe UI", 11),
        ).pack(padx=16)
        ttk.Button(popup, text="Ок", command=popup.destroy).pack(pady=16)
        popup.after(12000, popup.destroy)

    def _on_close(self) -> None:
        self._persist()
        self.destroy()


def main() -> None:
    app = BossTrackerApp()
    app.mainloop()


if __name__ == "__main__":
    main()
