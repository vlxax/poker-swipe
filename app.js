
const tg = window.Telegram?.WebApp;
if (tg) {
  tg.ready();
  tg.expand();
  tg.setHeaderColor?.("#09080d");
  tg.setBackgroundColor?.("#09080d");
}

const SAVE_KEY = "vyrasti_rega_v2";
const DEFAULT_STATE = {
  created:false,
  name:"",
  avatar:"🧑🏻‍💻",
  ev:0,
  bankroll:100,
  reputation:0,
  trainings:0,
  bestScore:0
};

let state = {...DEFAULT_STATE};
let selectedAvatar = "🧑🏻‍💻";
let currentQuestion = 0;
let correctAnswers = 0;
let answered = false;

const $ = id => document.getElementById(id);

function loadState(){
  try{
    const saved = JSON.parse(localStorage.getItem(SAVE_KEY));
    if(saved) state = {...DEFAULT_STATE, ...saved};
  }catch(e){
    console.warn("Не удалось прочитать сохранение", e);
  }
}

function saveState(){
  localStorage.setItem(SAVE_KEY, JSON.stringify(state));
}

function showScreen(name){
  document.querySelectorAll(".screen").forEach(el => el.classList.remove("screen--active"));
  $(`screen-${name}`).classList.add("screen--active");
  window.scrollTo({top:0, behavior:"smooth"});
}

function currentLevel(){
  return Math.max(1, Math.floor(state.ev / 200) + 1);
}

function rankName(){
  const level = currentLevel();
  if(level >= 25) return "Triton Regular";
  if(level >= 18) return "Легенда WSOP";
  if(level >= 12) return "High Roller";
  if(level >= 8) return "Crusher";
  if(level >= 5) return "Рег";
  if(level >= 3) return "Любитель";
  return "Новичок";
}

function updateHome(){
  const level = currentLevel();
  const levelBase = (level - 1) * 200;
  const levelProgress = state.ev - levelBase;

  $("home-avatar").textContent = state.avatar;
  $("room-avatar").textContent = state.avatar;
  $("home-name").textContent = state.name;
  $("home-rank").textContent = `Уровень ${level} · ${rankName()}`;
  $("stat-ev").textContent = state.ev;
  $("stat-bankroll").textContent = `$${state.bankroll}`;
  $("stat-reputation").textContent = state.reputation;
  $("level-progress-text").textContent = `${levelProgress} / 200 EV`;
  $("level-progress-bar").style.width = `${Math.min(levelProgress / 200 * 100, 100)}%`;

  const unlocked = state.bankroll >= 300;
  $("kaliningrad-state").textContent = unlocked ? "✅ Открыто" : "🔒 Закрыто";
  $("kaliningrad-state").className = unlocked ? "open" : "locked";
}

function updateProfile(){
  $("profile-avatar").textContent = state.avatar;
  $("profile-name").textContent = state.name;
  $("profile-rank").textContent = `Уровень ${currentLevel()} · ${rankName()}`;
  $("profile-trainings").textContent = state.trainings;
  $("profile-best").textContent = `${state.bestScore}/10`;
  $("profile-bankroll").textContent = `$${state.bankroll}`;
  $("profile-reputation").textContent = state.reputation;
}

function renderSeries(){
  $("series-list").innerHTML = SERIES.map(series => {
    const unlocked = state.bankroll >= series.bankroll && currentLevel() >= series.level;
    return `
      <button class="series-item" data-series="${series.id}">
        <div class="series-item__left">
          <div class="series-item__icon">${series.icon}</div>
          <div>
            <strong>${series.name}</strong>
            <small>${series.subtitle}</small>
          </div>
        </div>
        <div>
          <strong class="${unlocked ? "open" : "locked"}">${unlocked ? "Открыто" : "Закрыто"}</strong>
          <small>$${series.bankroll} · lvl ${series.level}</small>
        </div>
      </button>
    `;
  }).join("");

  document.querySelectorAll("[data-series]").forEach(button => {
    button.addEventListener("click", () => openCity(button.dataset.series));
  });
}

function openCity(id){
  const series = SERIES.find(item => item.id === id);
  if(!series) return;
  const unlocked = state.bankroll >= series.bankroll && currentLevel() >= series.level;
  $("city-title").textContent = series.name;
  $("city-content").innerHTML = `
    <div class="city-detail__icon">${series.icon}</div>
    <h1>${series.name}</h1>
    <p class="muted">${series.description}</p>
    <ul>
      <li>Требуется банкролл: $${series.bankroll}</li>
      <li>Требуется уровень: ${series.level}</li>
      <li>Награда: ${series.reward}</li>
    </ul>
    <button class="button ${unlocked ? "button--primary" : ""}" ${unlocked ? "" : "disabled"}>
      ${unlocked ? "Играть серию — скоро" : "Серия пока закрыта"}
    </button>
  `;
  showScreen("city");
}

function cardHTML(card){
  const rank = card[0];
  const suit = card.slice(1);
  const red = suit === "♥" || suit === "♦";
  return `<div class="playing-card ${red ? "red" : ""}"><span>${rank}</span><span class="suit">${suit}</span></div>`;
}

function renderQuestion(){
  answered = false;
  const question = QUESTIONS[currentQuestion];
  $("question-counter").textContent = `${currentQuestion + 1} / ${QUESTIONS.length}`;
  $("training-score").textContent = `${correctAnswers} верно`;
  $("training-progress").style.width = `${currentQuestion / QUESTIONS.length * 100}%`;
  $("cards").innerHTML = question.cards.map(cardHTML).join("");
  $("question-text").textContent = question.situation;
  $("question-position").textContent = question.position;
  $("question-stack").textContent = question.stack;
  $("answer-buttons").style.display = "grid";
  $("feedback").className = "panel feedback";
}

function finishTraining(){
  const earnedEv = correctAnswers * 20;
  const earnedMoney = correctAnswers * 5 + 25;
  const earnedReputation = Math.floor(correctAnswers / 2);

  state.ev += earnedEv;
  state.bankroll += earnedMoney;
  state.reputation += earnedReputation;
  state.trainings += 1;
  state.bestScore = Math.max(state.bestScore, correctAnswers);
  saveState();

  $("summary-score").textContent = `${correctAnswers} из ${QUESTIONS.length}`;
  $("reward-ev").textContent = `+${earnedEv}`;
  $("reward-money").textContent = `+$${earnedMoney}`;
  $("reward-reputation").textContent = `+${earnedReputation}`;

  let title, verdict;
  if(correctAnswers >= 9){
    title = "Поле уже начинает нервничать";
    verdict = "Фу. Слишком хорошо. Если продолжишь так же, друзья перестанут звать тебя в домашние игры. Дружба дружбой, а стек дороже.";
  }else if(correctAnswers >= 7){
    title = "Уже не бесплатный банкомат";
    verdict = "Сегодня ты временами вспоминал о существовании математики. Ещё немного дисциплины — и тебя начнут тихо ненавидеть за столом.";
  }else if(correctAnswers >= 5){
    title = "Рег на испытательном сроке";
    verdict = "Потенциал есть. Но иногда внутри тебя просыпается человек, который говорит: «а вдруг прокатит». Не прокатило.";
  }else{
    title = "Почётная рыба недели";
    verdict = "Ты не проиграл тренировку. Ты инвестировал в чужой отпуск. Не расстраивайся: рыб много, и вместе вы создаёте ликвидность.";
  }

  $("summary-title").textContent = title;
  $("summary-verdict").textContent = verdict;

  const missing = Math.max(300 - state.bankroll, 0);
  $("summary-goal").textContent = missing > 0
    ? `Твой банкролл: $${state.bankroll}. До первой серии осталось ещё $${missing}.`
    : `Банкролл уже позволяет ехать. Калининград открыт.`;

  showScreen("summary");
}

loadState();
if(state.created){
  updateHome();
  showScreen("home");
}

$("intro-start").addEventListener("click", () => showScreen("create"));

document.querySelectorAll(".avatar-card").forEach(button => {
  button.addEventListener("click", () => {
    document.querySelectorAll(".avatar-card").forEach(item => item.classList.remove("avatar-card--active"));
    button.classList.add("avatar-card--active");
    selectedAvatar = button.dataset.avatar;
  });
});

$("create-reg").addEventListener("click", () => {
  const name = $("reg-name").value.trim();
  if(!name){
    $("reg-name").focus();
    return;
  }
  state = {...DEFAULT_STATE, created:true, name, avatar:selectedAvatar};
  saveState();
  updateHome();
  showScreen("home");
});

$("reset-game").addEventListener("click", () => {
  if(confirm("Удалить рега и начать сначала?")){
    localStorage.removeItem(SAVE_KEY);
    state = {...DEFAULT_STATE};
    showScreen("intro");
  }
});

$("start-training").addEventListener("click", () => {
  currentQuestion = 0;
  correctAnswers = 0;
  renderQuestion();
  showScreen("training");
});

document.querySelectorAll("[data-answer]").forEach(button => {
  button.addEventListener("click", () => {
    if(answered) return;
    answered = true;
    const question = QUESTIONS[currentQuestion];
    const isCorrect = button.dataset.answer === question.correct;

    if(isCorrect) correctAnswers += 1;

    $("feedback-title").textContent = isCorrect ? "MATCH ❤️" : "RED FLAG 🚩";
    $("feedback-title").className = isCorrect ? "good" : "bad";
    $("feedback-explanation").textContent = question.explanation;
    $("feedback-comment").textContent = isCorrect ? question.good : question.bad;
    $("answer-buttons").style.display = "none";
    $("feedback").className = "panel feedback feedback--show";

    tg?.HapticFeedback?.notificationOccurred(isCorrect ? "success" : "error");
  });
});

$("next-question").addEventListener("click", () => {
  currentQuestion += 1;
  if(currentQuestion >= QUESTIONS.length) finishTraining();
  else renderQuestion();
});

$("summary-home").addEventListener("click", () => {
  updateHome();
  showScreen("home");
});

document.querySelectorAll("[data-open]").forEach(button => {
  button.addEventListener("click", () => {
    const screen = button.dataset.open;
    if(screen === "series") renderSeries();
    if(screen === "profile") updateProfile();
    showScreen(screen);
  });
});

document.querySelectorAll("[data-back]").forEach(button => {
  button.addEventListener("click", () => {
    const target = button.dataset.back;
    if(target === "home") updateHome();
    if(target === "series") renderSeries();
    showScreen(target);
  });
});

$("open-kaliningrad").addEventListener("click", () => openCity("kaliningrad"));
