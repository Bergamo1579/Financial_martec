(()=>{var e={};e.id=293,e.ids=[293],e.modules={399:e=>{"use strict";e.exports=require("next/dist/compiled/next-server/app-page.runtime.prod.js")},517:e=>{"use strict";e.exports=require("next/dist/compiled/next-server/app-route.runtime.prod.js")},9348:e=>{"use strict";e.exports=require("next/dist/server/app-render/work-async-storage.external.js")},412:e=>{"use strict";e.exports=require("next/dist/server/app-render/work-unit-async-storage.external.js")},455:(e,r,t)=>{"use strict";t.r(r),t.d(r,{patchFetch:()=>m,routeModule:()=>p,serverHooks:()=>l,workAsyncStorage:()=>d,workUnitAsyncStorage:()=>u});var a={};t.r(a),t.d(a,{GET:()=>o,dynamic:()=>c});var s=t(9344),n=t(1030),i=t(3964);let c="force-dynamic";async function o(){return new Response(`<!doctype html>
<html lang="pt-BR">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Financial Martec API Reference</title>
    <style>
      html, body {
        margin: 0;
        min-height: 100%;
        background:
          radial-gradient(circle at top left, rgba(217, 119, 6, 0.18), transparent 24%),
          radial-gradient(circle at top right, rgba(8, 76, 97, 0.16), transparent 28%),
          linear-gradient(180deg, #f7f1e6 0%, #efe8dc 100%);
      }
    </style>
  </head>
  <body>
    <div id="app"></div>
    <script src="https://cdn.jsdelivr.net/npm/@scalar/api-reference@1.49.1"></script>
    <script>
      Scalar.createApiReference('#app', {
        url: '/docs/openapi',
        proxyUrl: 'https://proxy.scalar.com',
      })
    </script>
  </body>
</html>`,{headers:{"content-type":"text/html; charset=utf-8"}})}let p=new s.AppRouteRouteModule({definition:{kind:n.RouteKind.APP_ROUTE,page:"/docs/reference/route",pathname:"/docs/reference",filename:"route",bundlePath:"app/docs/reference/route"},resolvedPagePath:"C:\\Users\\anderson.bergamo\\Music\\estudos_repo\\Social_project\\Financial_martec\\apps\\web\\app\\docs\\reference\\route.ts",nextConfigOutput:"",userland:a}),{workAsyncStorage:d,workUnitAsyncStorage:u,serverHooks:l}=p;function m(){return(0,i.patchFetch)({workAsyncStorage:d,workUnitAsyncStorage:u})}},7769:()=>{},8049:()=>{},9344:(e,r,t)=>{"use strict";e.exports=t(517)}};var r=require("../../../webpack-runtime.js");r.C(e);var t=e=>r(r.s=e),a=r.X(0,[964],()=>t(455));module.exports=a})();