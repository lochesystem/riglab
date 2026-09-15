// Keep source pixel coordinates: separating pieces never changes the model's UVs.
export function islandPieces(layout,width,height){
 return layout.islands.map(island=>{const x=Math.max(0,Math.floor(island.minX*width)),y=Math.max(0,Math.floor(island.minY*height)),right=Math.min(width,Math.ceil(island.maxX*width)),bottom=Math.min(height,Math.ceil(island.maxY*height));return {...island,x,y,width:right-x,height:bottom-y};}).filter(p=>p.width>0&&p.height>0);
}
export function packIslands(pieces){
 const gap=24,target=Math.max(512,Math.ceil(Math.sqrt(pieces.reduce((a,p)=>a+(p.width+gap)*(p.height+gap),0))),...pieces.map(p=>p.width+gap*2));let x=gap,y=gap,row=0,width=target;
 const packed=[...pieces].sort((a,b)=>b.height-a.height||a.id-b.id).map(p=>{if(x+p.width+gap>target){x=gap;y+=row+gap;row=0;}const result={...p,displayX:x,displayY:y};x+=p.width+gap;row=Math.max(row,p.height);return result;});return {pieces:packed,width,height:y+row+gap};
}
export function islandPath(ctx,piece,width,height,offsetX=0,offsetY=0){
 ctx.beginPath();for(const raw of piece.triangles){const t=(raw[1][0]-raw[0][0])*(raw[2][1]-raw[0][1])-(raw[1][1]-raw[0][1])*(raw[2][0]-raw[0][0])<0?[raw[0],raw[2],raw[1]]:raw;ctx.moveTo(t[0][0]*width+offsetX,t[0][1]*height+offsetY);for(let i=1;i<3;i++)ctx.lineTo(t[i][0]*width+offsetX,t[i][1]*height+offsetY);ctx.closePath();}
}
export function cropIsland(image,piece){const c=document.createElement('canvas');c.width=piece.width;c.height=piece.height;const ctx=c.getContext('2d');islandPath(ctx,piece,image.width,image.height,-piece.x,-piece.y);ctx.clip();ctx.drawImage(image,-piece.x,-piece.y);return c;}
export function restoreIsland(image,piece,edited){if(edited.width!==piece.width||edited.height!==piece.height)throw new Error(`A ilha deve ter ${piece.width} × ${piece.height} px.`);const c=document.createElement('canvas');c.width=image.width;c.height=image.height;const ctx=c.getContext('2d');ctx.drawImage(image,0,0);islandPath(ctx,piece,image.width,image.height);ctx.clip();ctx.drawImage(edited,piece.x,piece.y);return c;}
