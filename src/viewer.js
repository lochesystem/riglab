import * as THREE from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';

function disposeObject(root){
 const geometries=new Set(),materials=new Set(),textures=new Set(),skeletons=new Set();
 root?.traverse(o=>{if(o.skeleton)skeletons.add(o.skeleton);if(o.geometry)geometries.add(o.geometry);for(const m of (Array.isArray(o.material)?o.material:[o.material]).filter(Boolean)){materials.add(m);for(const value of Object.values(m))if(value?.isTexture)textures.add(value);}});
 skeletons.forEach(s=>s.dispose());geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());textures.forEach(t=>{t.dispose();t.source?.data?.close?.();});
}
export function createGLBViewer(){
 const dialog=document.createElement('dialog');dialog.className='glb-viewer';dialog.setAttribute('aria-label','Visualizador GLB');
 dialog.innerHTML=`<header><div><strong>Visualizador GLB</strong><span id="viewer-filename">Abra um modelo para começar</span></div><button id="viewer-open">Abrir GLB</button><button id="viewer-close" aria-label="Fechar visualizador">✕</button></header><div class="viewer-body"><div id="viewer-stage" aria-label="Prévia 3D"><div id="viewer-empty">Arraste um GLB aqui<br><small>Modelo, texturas e animações incorporados · até 80 MB</small></div></div><aside><label>Animação<select id="viewer-clip" disabled><option>Sem animações</option></select></label><div class="viewer-buttons"><button id="viewer-play" disabled>Reproduzir</button><button id="viewer-rewind" disabled>Reiniciar</button></div><label class="viewer-inline"><input id="viewer-loop" type="checkbox" checked/> Repetir animação</label><label>Velocidade<select id="viewer-speed"><option value="0.25">0,25×</option><option value="0.5">0,5×</option><option value="1" selected>1×</option><option value="1.5">1,5×</option><option value="2">2×</option></select></label><label>Tempo<input id="viewer-time" type="range" min="0" max="1" value="0" step="0.001" disabled/></label><output id="viewer-time-label">0,00 / 0,00 s</output><button id="viewer-frame" disabled>Enquadrar modelo</button><label class="viewer-inline"><input id="viewer-wire" type="checkbox"/> Mostrar malha</label><p id="viewer-stats">Nenhum arquivo aberto</p><p class="viewer-help">Arraste para orbitar · Scroll para aproximar. Os arquivos são abertos somente neste navegador.</p><p id="viewer-message" role="status"></p></aside></div><input id="viewer-file" type="file" accept=".glb" hidden/>`;
 document.body.append(dialog);const $=id=>dialog.querySelector('#viewer-'+id);
 let renderer,scene,camera,orbit,model,mixer,action,clips=[],floor,observer,raf,token=0,playing=false,last=0;
 const wireStates=new Map();
 function release(){if(mixer&&model){mixer.stopAllAction();mixer.uncacheRoot(model);}if(model){scene.remove(model);disposeObject(model);}model=null;mixer=null;action=null;clips=[];wireStates.clear();}
 function timeUI(){const t=action?.time||0,d=action?.getClip().duration||0;$('time').value=t;$('time-label').textContent=`${t.toFixed(2)} / ${d.toFixed(2)} s`;}
 function playUI(){$('play').textContent=playing?'Pausar':'Reproduzir';}
 function loop(){if(action){action.setLoop($('loop').checked?THREE.LoopRepeat:THREE.LoopOnce,Infinity);action.clampWhenFinished=true;}}
 function selectClip(){mixer.stopAllAction();action=mixer.clipAction(clips[Number($('clip').value)]);action.reset().play();action.paused=true;playing=false;loop();mixer.update(0);$('time').max=Math.max(0,action.getClip().duration);timeUI();playUI();}
 function frame(){if(!model)return;model.updateMatrixWorld(true);const box=new THREE.Box3().setFromObject(model),center=box.getCenter(new THREE.Vector3()),size=box.getSize(new THREE.Vector3());const radius=Math.max(size.length()/2,.05),fov=THREE.MathUtils.degToRad(camera.fov),distance=radius/Math.sin(Math.min(fov/2,Math.atan(Math.tan(fov/2)*camera.aspect)))*1.2;orbit.target.copy(center);camera.position.copy(center).add(new THREE.Vector3(.5,.25,1).normalize().multiplyScalar(distance));camera.near=Math.max(radius/1000,.0001);camera.far=Math.max(distance*100,radius*100);camera.updateProjectionMatrix();orbit.minDistance=radius*.1;orbit.maxDistance=distance*20;orbit.update();floor.position.set(center.x,box.min.y-radius*.003,center.z);floor.scale.setScalar(radius*12);}
 function resize(){const r=$('stage').getBoundingClientRect();if(!r.width||!r.height)return;renderer.setSize(r.width,r.height);camera.aspect=r.width/r.height;camera.updateProjectionMatrix();}
 function tick(now){if(!renderer)return;raf=requestAnimationFrame(tick);const dt=Math.min((now-last)/1000,.1);last=now;if(playing&&action){mixer.update(dt*Number($('speed').value));timeUI();}orbit.update();renderer.render(scene,camera);}
 function init(){scene=new THREE.Scene();scene.background=new THREE.Color('#252d30');camera=new THREE.PerspectiveCamera(40,1,.001,1000);renderer=new THREE.WebGLRenderer({antialias:true});renderer.setPixelRatio(Math.min(devicePixelRatio,2));renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.2;$('stage').prepend(renderer.domElement);orbit=new OrbitControls(camera,renderer.domElement);orbit.enableDamping=true;scene.add(new THREE.HemisphereLight(0xeaf3ff,0x72706a,2));const light=new THREE.DirectionalLight(0xfff2df,3);light.position.set(3,5,4);scene.add(light);floor=new THREE.Mesh(new THREE.PlaneGeometry(1,1),new THREE.MeshStandardMaterial({color:0x394543,roughness:1}));floor.rotation.x=-Math.PI/2;floor.visible=false;scene.add(floor);observer=new ResizeObserver(resize);observer.observe($('stage'));resize();last=performance.now();raf=requestAnimationFrame(tick);}
 async function load(file){
  if(!file)return;const request=++token;$('message').textContent='';
  if(!file.name.toLowerCase().endsWith('.glb')){$('message').textContent='Selecione um arquivo .glb.';return;}
  if(file.size>80*1024*1024){$('message').textContent='O limite é 80 MB por arquivo.';return;}
  $('message').textContent='Abrindo GLB…';let next;
  try{
   const manager=new THREE.LoadingManager();manager.setURLModifier(url=>{if(url.startsWith('blob:')||url.startsWith('data:'))return url;throw new Error('Use um GLB com geometria e texturas incorporadas.');});
   const gltf=await new GLTFLoader(manager).parseAsync(await file.arrayBuffer(),'');next=gltf.scene;
   if(request!==token||!dialog.open){disposeObject(next);return;}
   const bounds=new THREE.Box3().setFromObject(next);if(bounds.isEmpty()||![...bounds.min.toArray(),...bounds.max.toArray()].every(Number.isFinite))throw new Error('O arquivo não contém uma malha visível válida.');
   release();model=next;next=null;scene.add(model);clips=gltf.animations;mixer=new THREE.AnimationMixer(model);mixer.addEventListener('finished',()=>{playing=false;playUI();timeUI();});playing=false;playUI();
   $('wire').checked=false;let meshes=0,vertices=0,bones=0;model.traverse(o=>{if(o.isMesh){meshes++;vertices+=o.geometry.attributes.position?.count||0;for(const m of (Array.isArray(o.material)?o.material:[o.material]))if(m)wireStates.set(m,m.wireframe);}if(o.isBone)bones++;});
   $('filename').textContent=file.name;$('stats').textContent=`${meshes} malhas · ${vertices.toLocaleString('pt-BR')} vértices · ${bones} ossos · ${clips.length} animações`;
   $('clip').replaceChildren(...(clips.length?clips.map((c,i)=>new Option(c.name||`Animação ${i+1}`,String(i))):[new Option('Sem animações','')]));
   for(const id of ['clip','play','rewind','time'])$(id).disabled=!clips.length;
   $('frame').disabled=false;$('empty').hidden=true;floor.visible=true;frame();if(clips.length)selectClip();else timeUI();$('message').textContent=clips.length?'GLB pronto para visualizar.':'Modelo aberto. Este GLB não possui animações.';
  }catch(e){disposeObject(next);if(request===token&&dialog.open)$('message').textContent='Não foi possível abrir o GLB: '+e.message;}
  finally{$('file').value='';}
 }
 $('open').onclick=()=>$('file').click();$('file').onchange=e=>load(e.target.files[0]);$('close').onclick=()=>dialog.close();$('clip').onchange=selectClip;
 $('play').onclick=()=>{if(!action)return;playing=!playing;if(playing){if(action.time>=action.getClip().duration)action.reset().play();action.paused=false;loop();}else action.paused=true;playUI();};
 $('rewind').onclick=()=>{if(!action)return;playing=false;action.reset().play();action.paused=true;loop();mixer.update(0);timeUI();playUI();};
 $('time').oninput=e=>{if(!action)return;playing=false;action.enabled=true;action.paused=true;action.time=Number(e.target.value);mixer.update(0);timeUI();playUI();};
 $('loop').onchange=loop;$('frame').onclick=frame;$('wire').onchange=()=>wireStates.forEach((original,m)=>m.wireframe=$('wire').checked||original);
 dialog.addEventListener('dragover',e=>e.preventDefault());dialog.addEventListener('drop',e=>{e.preventDefault();load(e.dataTransfer.files[0]);});
 dialog.addEventListener('keydown',e=>e.stopPropagation());
 dialog.addEventListener('close',()=>{token++;cancelAnimationFrame(raf);observer?.disconnect();orbit?.dispose();release();disposeObject(floor);renderer?.dispose();renderer?.domElement.remove();renderer=null;playing=false;});
 return {open(){if(dialog.open)return;dialog.showModal();$('empty').hidden=false;$('filename').textContent='Abra um modelo para começar';$('stats').textContent='Nenhum arquivo aberto';$('message').textContent='';$('clip').replaceChildren(new Option('Sem animações',''));for(const id of ['clip','play','rewind','time','frame'])$(id).disabled=true;timeUI();playUI();try{init();}catch(e){$('message').textContent='Não foi possível iniciar a prévia 3D: '+e.message;}}};
}
