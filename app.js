
const $ = (s) => document.querySelector(s);
const $$ = (s) => [...document.querySelectorAll(s)];

const state = {
  index: 0,
  score: 0,
  yellow: 0,
  red: 0,
  ev: 2.58,
  rep: 2480,
  history: []
};

const ladyLines = {
  match: [
    "Надо же. Сегодня кнопки нажимаются не наугад.",
    "Очень интересно. Особенно приятно, что в этот раз оно ещё и правильное.",
    "GTO Wizard где-то тихо тобой гордится.",
    "Ладно. Это действительно было похоже на покер.",
    "Редкий случай: решение пережило проверку здравым смыслом."
  ],
  yellow: [
    "Жить можно. Богато — пока рано.",
    "Солвер слегка приподнял бровь.",
    "Погранично. Фриковая Дама пока не вызывает полицию.",
    "Не ужасно. Но можно было и не делить банк с совестью."
  ],
  red: [
    "Банкролл оценил и попросил больше так не делать.",
    "Ты снова выбрал характер вместо диапазона. Очень по-человечески.",
    "Это не эксплуатация. Это просто ошибка.",
    "Фриковая Дама официально просит отойти от кнопки и подумать."
  ]
};

const verdicts = {
  high: [
    "15 рук позади. <em>Ты начал думать до клика.</em> Неприятные новости для поля.",
    "Поле официально уведомлено: <em>ты перестал дарить EV бесплатно.</em>"
  ],
  mid: [
    "Банкролл выжил. Уже достижение. <em>Теперь попробуй ещё и принимать решения стабильно.</em>",
    "Рег внутри тебя найден. <em>Пока в бета-версии.</em>"
  ],
  low: [
    "Сегодня GTO Wizard был открыт… <em>на соседнем ноутбуке.</em>",
    "15 рук прошли. <em>Диапазоны тоже были где-то рядом, но вы разминулись.</em>"
  ]
};

function rand(arr){ return arr[Math.floor(Math.random()*arr.length)]; }

function show(id){
  $$(".screen").forEach(s => s.classList.toggle("active", s.id === id));
  window.scrollTo({top:0, behavior:"instant"});
}

function cardHTML(card){
  const [rank,suit] = card;
  const red = suit === "♥" || suit === "♦";
  return `<div class="card ${red ? "red":""}">
    <div class="rank">${rank}</div>
    <div class="suit">${suit}</div>
  </div>`;
}

function renderHand(){
  const h = HANDS[state.index];
  $("#handCount").textContent = `${state.index+1} / ${HANDS.length}`;
  $("#cards").innerHTML = h.cards.map(cardHTML).join("");
  $("#pos").textContent = h.position;
  $("#stack").textContent = h.stack;
  $("#pot").textContent = h.pot;
  $("#stage").textContent = h.stage;
  $("#situation").textContent = h.situation;
}

function startSwipe(){
  Object.assign(state,{index:0,score:0,yellow:0,red:0,ev:2.58,rep:2480,history:[]});
  renderHand();
  show("game");
}

function choose(action){
  const hand = HANDS[state.index];
  const result = hand.actions[action];
  state.history.push({handId:hand.id, action, grade:result.grade});
  if(result.grade === "match"){ state.score++; state.ev += 0.14; state.rep += 12; }
  else if(result.grade === "yellow"){ state.yellow++; state.ev -= 0.03; state.rep += 2; }
  else { state.red++; state.ev -= 0.12; state.rep -= 4; }

  $("#resultCards").innerHTML = hand.cards.map(cardHTML).join("");
  const flag = $("#flag");
  flag.className = `flag ${result.grade}`;
  flag.textContent = result.grade === "match" ? "MATCH ❤️" : result.grade === "yellow" ? "YELLOW FLAG 🚩" : "RED FLAG 🚩";
  $("#resultTitle").textContent = result.grade === "match" ? "Правильное решение!" : result.grade === "yellow" ? "Среднее решение" : "Неправильное решение!";
  $("#explain").textContent = result.text;
  $("#ladyText").textContent = rand(ladyLines[result.grade]);
  show("result");
}

function nextHand(){
  state.index++;
  if(state.index >= HANDS.length){ finish(); return; }
  renderHand();
  show("game");
}

function finish(){
  const ratio = state.score / HANDS.length;
  const tier = ratio >= .8 ? "high" : ratio >= .5 ? "mid" : "low";
  $("#finalQuote").innerHTML = rand(verdicts[tier]);
  $("#score").textContent = `${state.score} / ${HANDS.length}`;
  $("#finalEv").textContent = `${state.ev >= 0 ? "+" : ""}${state.ev.toFixed(2)}`;
  $("#finalRep").textContent = state.rep.toLocaleString("ru-RU");
  $("#evTop").textContent = `${state.ev >= 0 ? "+" : ""}${state.ev.toFixed(2)}`;
  $("#repTop").textContent = state.rep.toLocaleString("ru-RU");
  show("verdict");
}

function toast(text){
  const t = $("#toast");
  t.textContent = text;
  t.classList.add("show");
  setTimeout(()=>t.classList.remove("show"),1600);
}

$("#startSwipe").addEventListener("click", startSwipe);
$("#fastGame").addEventListener("click", () => toast("Быструю игру подключаем следующим модулем ⚡"));
$("#backHome").addEventListener("click", () => show("home"));
$$(".action").forEach(btn => btn.addEventListener("click", () => choose(btn.dataset.action)));
$("#nextHand").addEventListener("click", nextHand);
$("#continueBtn").addEventListener("click", () => show("home"));
$("#againBtn").addEventListener("click", startSwipe);
