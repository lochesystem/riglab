// Reuse the editor's controls and handlers; only their presentation changes.
export function setupInspector(onTabChange){
 const $=s=>document.querySelector(s),panel=$('.right-panel'),host=$('#pose-panel');
 const joint=$('#joint-select').closest('.panel-section');joint.classList.add('joint-inspector');
 const channels=document.createElement('details');channels.open=true;channels.innerHTML='<summary class="joint-summary">Articulação selecionada<span aria-hidden="true">⌃</span></summary>';joint.querySelector('h3').remove();channels.append(...joint.childNodes);joint.append(channels);
 $('.inspector-footer').remove();
 const pages={};const tabs=document.createElement('div');tabs.className='inspector-tabs';tabs.setAttribute('role','tablist');tabs.setAttribute('aria-label','Ferramentas do personagem');
 for(const [id,label] of [['pose','Pose'],['animation','Animações'],['weights','Pesos']]){
  const button=document.createElement('button');button.type='button';button.id=`inspector-tab-${id}`;button.textContent=label;button.setAttribute('role','tab');button.setAttribute('aria-controls',`inspector-page-${id}`);button.onclick=()=>select(id);tabs.append(button);
  const page=document.createElement('div');page.id=`inspector-page-${id}`;page.className='inspector-page';page.setAttribute('role','tabpanel');page.setAttribute('aria-labelledby',button.id);pages[id]=page;
 }
 host.append(tabs,...Object.values(pages));
 const poseNodes=[host.querySelector('h3'),host.querySelector('.segmented'),$('#neutral'),$('#wave'),$('#edit-rig')];pages.pose.append(...poseNodes);
 const walk=$('#walk').closest('.walk-generator'),motion=$('#idle').closest('.walk-generator');
 const choice=document.createElement('label');choice.className='motion-choice';choice.innerHTML='Animação<select id="animation-kind" aria-label="Tipo de animação"><option value="walk">Caminhada</option><option value="idle">Idle · em espera</option><option value="run">Corrida</option><option value="jump">Pulo</option><option value="punch">Ataque · 1 soco</option><option value="combo">Ataque · 3 socos</option></select>';
 pages.animation.append(choice,walk,motion);
 walk.querySelector('h3').remove();motion.querySelector('h3').remove();
 walk.querySelector('p').textContent='Substitui o clipe · Desfazer recupera';
 const description=motion.querySelector('p');
 function selectMotion(){const kind=choice.querySelector('select').value;walk.hidden=kind!=='walk';motion.hidden=kind==='walk';$('#idle').hidden=kind!=='idle';$('#run').hidden=kind!=='run';$('#jump').hidden=kind!=='jump';$('#punch').hidden=kind!=='punch';$('#combo').hidden=kind!=='combo';description.textContent='Substitui o clipe · Desfazer recupera';}
 choice.querySelector('select').onchange=selectMotion;selectMotion();
 const painting=$('#paint-toggle').closest('.walk-generator'),refine=$('#refine-weights'),refineHelp=refine.nextElementSibling;
 pages.weights.append(painting);
 const advanced=document.createElement('details');advanced.className='inspector-disclosure';advanced.innerHTML='<summary>Espelhamento e proteção</summary>';
 for(const id of ['paint-mirror','paint-visible','paint-lock'])advanced.append($(`#${id}`).closest('label'));
 $('#paint-undo').before(advanced);
 const help=document.createElement('details');help.className='inspector-disclosure';help.innerHTML='<summary>Como pintar</summary>';const hint=$('#paint-options p.muted');help.append(hint);$('#paint-options').append(help);
 const recalc=document.createElement('details');recalc.className='inspector-disclosure';recalc.innerHTML='<summary>Recalcular pesos</summary>';recalc.append(refine,refineHelp);refineHelp.textContent='Substitui a pintura atual. Mantém o esqueleto e o clipe.';pages.weights.append(recalc);
 host.replaceChildren(tabs,...Object.values(pages));
 function select(id){for(const [key,page] of Object.entries(pages)){page.hidden=key!==id;const button=$(`#inspector-tab-${key}`);button.setAttribute('aria-selected',String(key===id));button.tabIndex=key===id?0:-1;}onTabChange(id);}
 tabs.addEventListener('keydown',e=>{const buttons=[...tabs.children],index=buttons.indexOf(document.activeElement);let next;if(e.key==='ArrowRight')next=(index+1)%3;else if(e.key==='ArrowLeft')next=(index+2)%3;else if(e.key==='Home')next=0;else if(e.key==='End')next=2;else return;e.preventDefault();buttons[next].click();buttons[next].focus();});
 select('pose');
 return {sync(stage){panel.dataset.stage=stage;}};
}
