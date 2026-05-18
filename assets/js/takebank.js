// Beckett — interactive take bank
// Clicking a take reveals its matched AI Mode prompt inline.
// Take → prompt mapping per CONCEPT.md §3.5 / §3.6.

const TAKES = {
  cfb: [
    {
      take: "The wrong guy has the ball right now.",
      prompt: "Is it better to have the ball or the lead late in a close game?",
      hint: "Hero take · 4th Q · one-score game"
    },
    {
      take: "That punt was a coward's punt.",
      prompt: "Is it smarter to punt or go for it on 4th down late in a close game?",
      hint: "Halftime or 4th Q · close score"
    },
    {
      take: "Your QB is playing scared.",
      prompt: "Should a team play for the tie or the win when down 6 in the 4th?",
      hint: "4th Q · close · trailing"
    },
    {
      take: "This game was lost in the 2nd quarter.",
      prompt: "Why do early-season games stay close?",
      hint: "Halftime · close score"
    },
    {
      take: "You're blaming the defense. It's not the defense.",
      prompt: "What's the best defense to run when protecting a small lead?",
      hint: "4th Q · lead under threat"
    },
    {
      take: "A close win over an unranked team is not a statement.",
      prompt: "Does a close win hurt a team's Playoff chances?",
      hint: "Late · close vs. unranked"
    },
    {
      take: "This result just blew up the rankings.",
      prompt: "How much do the rankings move after a close upset?",
      hint: "Late · ranking implications live"
    }
  ],
  nba: [
    {
      take: "Somebody on this floor just disappeared.",
      prompt: "Who usually decides a close NBA game — the star or the role players?",
      hint: "Hero take · 4th Q · one-possession game"
    },
    {
      take: "Your star hasn't taken a real shot in 8 minutes.",
      prompt: "Why do teams go cold in the 4th quarter of close games?",
      hint: "4th Q · star gone quiet"
    },
    {
      take: "That timeout came too late.",
      prompt: "How important is clock management late in close games?",
      hint: "Final 2 min · close"
    },
    {
      take: "This isn't a close game. One team is choking.",
      prompt: "Why do NBA teams collapse with a 4th-quarter lead?",
      hint: "4th Q · lead shrinking"
    },
    {
      take: "The bench is the reason you're still in this.",
      prompt: "How important is the bench in a tight playoff game?",
      hint: "Late · bench keeping it close"
    },
    {
      take: "Wrong guy is about to take the last shot.",
      prompt: "Is it better to take the last shot or play for two possessions?",
      hint: "Final possession · last shot looming"
    },
    {
      take: "That foul-or-don't call is yours to make.",
      prompt: "Should you foul up 3 in the final seconds?",
      hint: "Final seconds · defense up 3"
    }
  ]
};

function buildTakeBank() {
  const reveal = document.querySelector("[data-take-reveal]");
  if (!reveal) return;

  const renderCol = (key, mountSel) => {
    const mount = document.querySelector(mountSel);
    if (!mount) return;
    TAKES[key].forEach((item, i) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "take";
      btn.dataset.sport = key;
      btn.dataset.idx = i;
      btn.innerHTML = `<span class="arrow">▸</span>${item.take}`;
      btn.addEventListener("click", () => activate(btn, item));
      mount.appendChild(btn);
    });
  };

  const activate = (btn, item) => {
    document.querySelectorAll(".take.active").forEach(el => el.classList.remove("active"));
    btn.classList.add("active");
    reveal.classList.remove("empty");
    reveal.innerHTML = `
      <div class="rv-k">Hands off to AI Mode →</div>
      <div class="rv-q">"${item.prompt}"</div>
      <div class="rv-h">${item.hint}</div>
    `;
  };

  renderCol("cfb", "[data-takes='cfb']");
  renderCol("nba", "[data-takes='nba']");
}

document.addEventListener("DOMContentLoaded", buildTakeBank);
