(function(){
  'use strict';

  const BASE='assets/freak-lady';
  const stateToAsset={
    idle:'idle', thinking:'thinking', correct:'correct', streak:'streak',
    wrong:'wrong', skeptical:'skeptical', g:'correct', y:'skeptical', r:'wrong'
  };
  const phraseMap={
    swipe:{
      g:['ЧИСТО','Я даже спорить не буду.'],
      y:['ЖИВЁТ','Но тонко. Не расслабляйся.'],
      r:['ОШИБКА','Вот здесь уже дорого.']
    },
    sizing:{
      g:['САЙЗИНГ СЕЛ','Банк не вырос раньше причины.'],
      y:['ЖИВЁТ','Размер уже просит адвоката.'],
      r:['ПЕРЕБОР','Сначала причина. Потом большой банк.']
    },
    review:{
      g:['НАШЛА','Место преступления определено.'],
      y:['ПОЧТИ','Починилось, но швы ещё видно.'],
      r:['МИМО','Следствие ушло не по той улице.']
    },
    daily:{
      g:['СОШЛОСЬ','Логика неприятно хорошо собралась.'],
      y:['ЕСТЬ РАБОТА','Часть аргументов живёт. Часть уже в суде.'],
      r:['ДОКРУЧИ','Решение есть. Архитектуры пока нет.']
    },
    solver:{
      thinking:['СЧИТАЮ EV','Не мешай взрослым числам.'],
      g:['SOLVER ДОВОЛЕН','Повода для драмы почти нет.'],
      y:['ТОНКО','Не катастрофа, но деньги уже шуршат.'],
      r:['EV УЕХАЛ','Вот здесь ошибка уже стоит денег.']
    },
    session:{
      streak:['СЕРИЯ','Прилично. Не привыкай.'],
      g:['СЕССИЯ ЧИСТАЯ','Подозрительно хорошо.'],
      y:['ЖИВЁШЬ','Слишком много пограничного.'],
      r:['ЛИК НАЙДЕН','Кажется, у нас появился любимый способ терять EV.']
    }
  };

  const cache=new Map();
  const players=new WeakMap();

  function normalizeMood(mood){
    if(mood==='g'||mood==='y'||mood==='r'||mood==='thinking'||mood==='streak')return mood;
    if(mood==='correct')return 'g';
    if(mood==='skeptical')return 'y';
    if(mood==='wrong')return 'r';
    return 'thinking';
  }

  function loadAsset(asset){
    if(cache.has(asset))return cache.get(asset);
    const task=Promise.all([
      fetch(`${BASE}/${asset}/sprite.json`,{cache:'force-cache'}).then(r=>{if(!r.ok)throw new Error('sprite json');return r.json()}),
      new Promise((resolve,reject)=>{const img=new Image();img.onload=()=>resolve(img);img.onerror=reject;img.src=`${BASE}/${asset}/sprite.png`;})
    ]).then(([json,img])=>({json,img,frames:Object.entries(json.frames||{}).sort((a,b)=>a[0].localeCompare(b[0]))}));
    cache.set(asset,task);
    return task;
  }

  function stopPlayer(canvas){
    const p=players.get(canvas);
    if(p){p.dead=true;if(p.raf)cancelAnimationFrame(p.raf);players.delete(canvas)}
  }

  async function play(canvas,mood,loop){
    stopPlayer(canvas);
    const asset=stateToAsset[mood]||stateToAsset[normalizeMood(mood)]||'idle';
    let loaded;
    try{loaded=await loadAsset(asset)}catch(_){return}
    if(!canvas.isConnected)return;
    const {json,img,frames}=loaded;
    if(!frames.length)return;
    const first=frames[0][1];
    const sw=(first.sourceSize&&first.sourceSize.w)||first.frame.w;
    const sh=(first.sourceSize&&first.sourceSize.h)||first.frame.h;
    canvas.width=sw;canvas.height=sh;
    const ctx=canvas.getContext('2d');
    const player={dead:false,raf:0,i:0,last:performance.now()};players.set(canvas,player);
    const reduced=window.matchMedia&&window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    function draw(i){
      const fr=frames[i][1].frame;
      ctx.clearRect(0,0,sw,sh);
      ctx.drawImage(img,fr.x,fr.y,fr.w,fr.h,0,0,sw,sh);
    }
    draw(0);
    if(reduced)return;
    function tick(ts){
      if(player.dead||!canvas.isConnected)return;
      const data=frames[player.i][1];
      const dur=Math.max(34,Number(data.duration)||43);
      if(ts-player.last>=dur){
        player.last=ts;
        player.i++;
        if(player.i>=frames.length){
          if(loop)player.i=0;else{player.i=frames.length-1;draw(player.i);return}
        }
        draw(player.i);
      }
      player.raf=requestAnimationFrame(tick);
    }
    player.raf=requestAnimationFrame(tick);
  }

  function copyFor(context,mood){
    const n=normalizeMood(mood);
    const ctx=phraseMap[context]||phraseMap.swipe;
    return ctx[mood]||ctx[n]||ctx.thinking||['ФРИКОВАЯ ДАМА','Смотрю.'];
  }

  function react(target,mood='thinking',context='swipe',opts={}){
    if(!target||!target.isConnected)return null;
    const normalized=normalizeMood(mood);
    const prior=target.querySelector(':scope > .freakCoachReaction');
    if(prior)prior.remove();
    const row=document.createElement('div');
    row.className='freakCoachReaction'+(opts.wide?' freakCoachWide':'')+(normalized==='thinking'?' freakCoachThinking':'');
    row.dataset.mood=mood;
    row.setAttribute('aria-label','Реакция Фриковой Дамы');
    const avatar=document.createElement('div');avatar.className='freakCoachAvatarWrap';
    const canvas=document.createElement('canvas');canvas.className='freakCoachAvatar';canvas.setAttribute('aria-hidden','true');avatar.appendChild(canvas);
    const copy=document.createElement('div');copy.className='freakCoachCopy';
    const [head,body]=copyFor(context,mood);
    copy.innerHTML=`<span class="ey">ФРИКОВАЯ ДАМА · ${head}</span><strong>${body}</strong>`;
    row.append(avatar,copy);
    const button=target.querySelector(':scope > .primary, :scope > .secondary, :scope > button.primary, :scope > button.secondary, #holdArea');
    if(button)target.insertBefore(row,button);else target.appendChild(row);
    const loop=normalized==='thinking'||normalized==='idle';
    play(canvas,mood,loop);
    return row;
  }

  function sessionMood(g,y,r){
    if(g>=8&&r<=1)return 'streak';
    if(r>=4)return 'r';
    if(y>=4||r>=2)return 'y';
    return 'g';
  }

  window.FreakLady={react,play,sessionMood,assets:stateToAsset};
})();
