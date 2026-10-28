/* Keep the mobile storefront at its intended scale without blocking scroll or buttons. */
(function(){
 'use strict';
 const stopZoom=event=>event.preventDefault();
 document.addEventListener('gesturestart',stopZoom,{passive:false});
 document.addEventListener('gesturechange',stopZoom,{passive:false});
 let previousTap=null;
 document.addEventListener('touchend',event=>{
  if(event.touches.length||event.changedTouches.length!==1){previousTap=null;return}
  const target=event.target;
  // Fast quantity changes, image arrows and map gestures retain their normal behavior.
  if(target.closest?.('button,a,input,textarea,select,label,.leaflet-container')){previousTap=null;return}
  const touch=event.changedTouches[0],now=Date.now();
  if(previousTap&&now-previousTap.at<300&&Math.hypot(touch.clientX-previousTap.x,touch.clientY-previousTap.y)<24){event.preventDefault();previousTap=null}
  else previousTap={at:now,x:touch.clientX,y:touch.clientY};
 },{passive:false});
})();
