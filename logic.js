 // ===== State & Persistence =====
    const store = {
      load(){
        try{
          return JSON.parse(localStorage.getItem('pomodoro-simple')) || {};
        }catch{ return {}; }
      },
      save(data){ localStorage.setItem('pomodoro-simple', JSON.stringify(data)); }
    };

    const $ = sel => document.querySelector(sel);
    const $$ = sel => Array.from(document.querySelectorAll(sel));

    const state = {
      mode: 'focus',
      remaining: 25*60,
      running: false,
      interval: null,
      session: 1,
      completed: 0,
      cyclesToLong: 4,
      autoStart: true,
      durations: { focus: 25*60, short: 5*60, long: 15*60 },
      tasks: []
    };

    function applyFromStorage(){
      const s = store.load();
      if(!s) return;
      if(s.durations){ state.durations = s.durations; }
      if(typeof s.cyclesToLong === 'number'){ state.cyclesToLong = s.cyclesToLong; }
      if(typeof s.autoStart === 'boolean'){ state.autoStart = s.autoStart; }
      if(Array.isArray(s.tasks)) state.tasks = s.tasks;
      state.mode = s.mode || 'focus';
      // UI sync
      $('#focusMins').value = Math.round(state.durations.focus/60);
      $('#shortMins').value = Math.round(state.durations.short/60);
      $('#longMins').value = Math.round(state.durations.long/60);
      $('#cyclesToLong').value = String(state.cyclesToLong);
      $('#autoStart').value = state.autoStart ? 'on' : 'off';
      switchMode(state.mode, false);
      renderTasks();
    }

    function persist(){
      store.save({
        mode: state.mode,
        durations: state.durations,
        cyclesToLong: state.cyclesToLong,
        autoStart: state.autoStart,
        tasks: state.tasks
      });
    }

    // ===== Timer Logic =====
    function format(sec){ const m = Math.floor(sec/60); const s = sec%60; return `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`; }

    function switchMode(mode, resetSession=true){
      state.mode = mode;
      state.remaining = state.durations[mode];
      $('.time').textContent = format(state.remaining);
      $$('.mode-btn').forEach(btn=>{
        const active = btn.dataset.mode === mode;
        btn.classList.toggle('active', active);
        btn.setAttribute('aria-selected', active ? 'true' : 'false');
      });
      if(resetSession){ $('#startPauseBtn').textContent = 'Start'; state.running=false; clearInterval(state.interval); }
      updateStats();
      persist();
    }

    function updateStats(){
      $('#completedCount').textContent = String(state.completed);
      $('#stats').textContent = `Session #${state.session} • Completed: ${state.completed}`;
      document.title = `${format(state.remaining)} — ${state.mode==='focus'?'Focus':'Break'}`;
    }

    function tick(){
      if(!state.running) return;
      state.remaining--;
      
      if(state.remaining<=0){
        endSession();
        return;
      }
      $('.time').textContent = format(state.remaining);
      updateStats();
    }

    function start(){
      if(state.running) return;
      state.running = true;
      $('#startPauseBtn').textContent = 'Pause';
      state.interval = setInterval(tick, 1000);
    }

    function pause(){
      state.running = false;
      $('#startPauseBtn').textContent = 'Start';
      clearInterval(state.interval);
    }

    function resetTimer(){
      pause();
      state.remaining = state.durations[state.mode];
      $('.time').textContent = format(state.remaining);
      updateStats();
    }

    function nextSession(){
      // Determine next mode
      if(state.mode==='focus'){
        state.completed++;
        if(state.session % state.cyclesToLong === 0){
          state.mode='long';
        }else{
          state.mode='short';
        }
      }else{
        state.mode='focus';
        state.session++;
      }
      switchMode(state.mode);
      if($('#autoStart').value==='on' && state.autoStart){ start(); }
      playBeep();
      persist();
    }

    function endSession(){
      pause();
      nextSession();
    }

    function playBeep(){
      const a = $('#beep');
      a.currentTime = 0; a.play().catch(()=>{});
    }

    // ===== To‑Do Logic =====
    function renderTasks(){
      const ul = $('#todoList');
      ul.innerHTML = '';
      state.tasks.forEach((t, idx)=>{
        const li = document.createElement('li'); li.className = 'todo-item' + (t.done? ' done':'');
        const cb = document.createElement('input'); cb.type='checkbox'; cb.checked = !!t.done; cb.addEventListener('change', ()=>{ t.done = cb.checked; persist(); renderTasks(); });
        const title = document.createElement('div'); title.className='title'; title.textContent = t.title;
        const del = document.createElement('button'); del.title='Delete'; del.innerHTML='🗑'; del.addEventListener('click', ()=>{ state.tasks.splice(idx,1); persist(); renderTasks(); });
        li.append(cb, title, del);
        ul.appendChild(li);
      });
    }

    function addTask(txt){
      if(!txt || !txt.trim()) return;
      state.tasks.unshift({ title: txt.trim(), done:false });
      $('#todoInput').value='';
      persist();
      renderTasks();
    }

    // ===== Events =====
    $('#startPauseBtn').addEventListener('click', ()=> state.running ? pause() : start());
    $('#resetBtn').addEventListener('click', resetTimer);
    $('#skipBtn').addEventListener('click', nextSession);

    $$('.mode-btn').forEach(btn=> btn.addEventListener('click', ()=> switchMode(btn.dataset.mode)) );

    $('#focusMins').addEventListener('change', e=>{ state.durations.focus = Math.max(1, +e.target.value)*60; if(state.mode==='focus') resetTimer(); });
    $('#shortMins').addEventListener('change', e=>{ state.durations.short = Math.max(1, +e.target.value)*60; if(state.mode==='short') resetTimer(); });
    $('#longMins').addEventListener('change', e=>{ state.durations.long = Math.max(1, +e.target.value)*60; if(state.mode==='long') resetTimer(); });
    $('#cyclesToLong').addEventListener('change', e=>{ state.cyclesToLong = +e.target.value; updateStats(); });
    $('#autoStart').addEventListener('change', e=>{ state.autoStart = e.target.value==='on'; persist(); });

    $('#saveSettingsBtn').addEventListener('click', ()=>{ persist(); playBeep(); });
    $('#resetAllBtn').addEventListener('click', ()=>{
      if(confirm('Reset everything? This will clear your tasks and settings.')){
        localStorage.removeItem('pomodoro-simple');
        location.reload();
      }
    });

    $('#testSound').addEventListener('click', playBeep);

    $('#addTodoBtn').addEventListener('click', ()=> addTask($('#todoInput').value));
    $('#todoInput').addEventListener('keydown', e=>{
      if(e.key==='Enter') addTask(e.target.value);
    });

    document.addEventListener('keydown', (e)=>{
      if(['INPUT','TEXTAREA'].includes(document.activeElement.tagName)) return;
      if(e.code==='Space'){ e.preventDefault(); state.running? pause(): start(); }
      if(e.key.toLowerCase()==='n'){ nextSession(); }
      if(e.key.toLowerCase()==='r'){ resetTimer(); }
    });

    // Boot
    switchMode('focus');
    applyFromStorage();
