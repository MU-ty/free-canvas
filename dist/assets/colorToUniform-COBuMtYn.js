import{w as H,G as W,c as _}from"./index-DIyq8Pc6.js";function I(e,t,o){if(e)for(const r in e){const n=r.toLocaleLowerCase(),c=t[n];if(c){let a=e[r];r==="header"&&(a=a.replace(/@in\s+[^;]+;\s*/g,"").replace(/@out\s+[^;]+;\s*/g,"")),o&&c.push(`//----${o}----//`),c.push(a)}else H(`${r} placement hook does not exist in shader`)}}const k=/\{\{(.*?)\}\}/g;function j(e){const t={};return(e.match(k)?.map(r=>r.replace(/[{()}]/g,""))??[]).forEach(r=>{t[r]=[]}),t}function G(e,t){let o;const r=/@in\s+([^;]+);/g;for(;(o=r.exec(e))!==null;)t.push(o[1])}function y(e,t,o=!1){const r=[];G(t,r),e.forEach(i=>{i.header&&G(i.header,r)});const n=r;o&&n.sort();const c=n.map((i,s)=>`       @location(${s}) ${i},`).join(`
`);let a=t.replace(/@in\s+[^;]+;\s*/g,"");return a=a.replace("{{in}}",`
${c}
`),a}function R(e,t){let o;const r=/@out\s+([^;]+);/g;for(;(o=r.exec(e))!==null;)t.push(o[1])}function D(e){const o=/\b(\w+)\s*:/g.exec(e);return o?o[1]:""}function E(e){const t=/@.*?\s+/g;return e.replace(t,"")}function L(e,t){const o=[];R(t,o),e.forEach(s=>{s.header&&R(s.header,o)});let r=0;const n=o.sort().map(s=>s.indexOf("builtin")>-1?s:`@location(${r++}) ${s}`).join(`,
`),c=o.sort().map(s=>`       var ${E(s)};`).join(`
`),a=`return VSOutput(
                ${o.sort().map(s=>` ${D(s)}`).join(`,
`)});`;let i=t.replace(/@out\s+[^;]+;\s*/g,"");return i=i.replace("{{struct}}",`
${n}
`),i=i.replace("{{start}}",`
${c}
`),i=i.replace("{{return}}",`
${a}
`),i}function B(e,t){let o=e;for(const r in t){const n=t[r];n.join(`
`).length?o=o.replace(`{{${r}}}`,`//-----${r} START-----//
${n.join(`
`)}
//----${r} FINISH----//`):o=o.replace(`{{${r}}}`,"")}return o}const u=Object.create(null),M=new Map;let O=0;function F({template:e,bits:t}){const o=A(e,t);if(u[o])return u[o];const{vertex:r,fragment:n}=X(e,t);return u[o]=z(r,n,t),u[o]}function N({template:e,bits:t}){const o=A(e,t);return u[o]||(u[o]=z(e.vertex,e.fragment,t)),u[o]}function X(e,t){const o=t.map(a=>a.vertex).filter(a=>!!a),r=t.map(a=>a.fragment).filter(a=>!!a);let n=y(o,e.vertex,!0);n=L(o,n);const c=y(r,e.fragment,!0);return{vertex:n,fragment:c}}function A(e,t){return t.map(o=>(M.has(o)||M.set(o,O++),M.get(o))).sort((o,r)=>o-r).join("-")+e.vertex+e.fragment}function z(e,t,o){const r=j(e),n=j(t);return o.forEach(c=>{I(c.vertex,r,c.name),I(c.fragment,n,c.name)}),{vertex:B(e,r),fragment:B(t,n)}}const Y=`
    @in aPosition: vec2<f32>;
    @in aUV: vec2<f32>;

    @out @builtin(position) vPosition: vec4<f32>;
    @out vUV : vec2<f32>;
    @out vColor : vec4<f32>;

    {{header}}

    struct VSOutput {
        {{struct}}
    };

    @vertex
    fn main( {{in}} ) -> VSOutput {

        var worldTransformMatrix = globalUniforms.uWorldTransformMatrix;
        var modelMatrix = mat3x3<f32>(
            1.0, 0.0, 0.0,
            0.0, 1.0, 0.0,
            0.0, 0.0, 1.0
          );
        var position = aPosition;

        {{start}}
        
        vColor = vec4<f32>(1., 1., 1., 1.);
        vUV = aUV;

        {{main}}

        var modelViewProjectionMatrix = globalUniforms.uProjectionMatrix * worldTransformMatrix * modelMatrix;

        vPosition =  vec4<f32>((modelViewProjectionMatrix *  vec3<f32>(position, 1.0)).xy, 0.0, 1.0);
       
        vColor *= globalUniforms.uWorldColorAlpha;

        {{end}}

        {{return}}
    };
`,q=`
    @in vUV : vec2<f32>;
    @in vColor : vec4<f32>;
   
    {{header}}

    @fragment
    fn main(
        {{in}}
      ) -> @location(0) vec4<f32> {
        
        {{start}}

        var outColor:vec4<f32>;
      
        {{main}}
        
        return outColor * vColor;
      };
`,w=`
    in vec2 aPosition;
    in vec2 aUV;

    out vec4 vColor;
    out vec2 vUV;

    {{header}}

    void main(void){

        mat3 worldTransformMatrix = uWorldTransformMatrix;
        mat3 modelMatrix = mat3(
            1.0, 0.0, 0.0,
            0.0, 1.0, 0.0,
            0.0, 0.0, 1.0
          );
        vec2 position = aPosition;

        {{start}}
        
        vColor = vec4(1.);
        vUV = aUV;

        {{main}}

        mat3 modelViewProjectionMatrix = uProjectionMatrix * worldTransformMatrix * modelMatrix;

        gl_Position = vec4((modelViewProjectionMatrix * vec3(position, 1.0)).xy, 0.0, 1.0);

        vColor *= uWorldColorAlpha;

        {{end}}
    }
`,J=`
   
    in vec4 vColor;
    in vec2 vUV;

    out vec4 finalColor;

    {{header}}

    void main(void) {
        
        {{start}}

        vec4 outColor;
      
        {{main}}
        
        finalColor = outColor * vColor;
    }
`,K={name:"global-uniforms-bit",vertex:{header:`
        struct GlobalUniforms {
            uProjectionMatrix:mat3x3<f32>,
            uWorldTransformMatrix:mat3x3<f32>,
            uWorldColorAlpha: vec4<f32>,
            uResolution: vec2<f32>,
        }

        @group(0) @binding(0) var<uniform> globalUniforms : GlobalUniforms;
        `}},Q={name:"global-uniforms-bit",vertex:{header:`
          uniform mat3 uProjectionMatrix;
          uniform mat3 uWorldTransformMatrix;
          uniform vec4 uWorldColorAlpha;
          uniform vec2 uResolution;
        `}};function ro({bits:e,name:t}){const o=F({template:{fragment:q,vertex:Y},bits:[K,...e]});return W.from({name:t,vertex:{source:o.vertex,entryPoint:"main"},fragment:{source:o.fragment,entryPoint:"main"}})}function eo({bits:e,name:t}){return new _({name:t,...N({template:{vertex:w,fragment:J},bits:[Q,...e]})})}const no={name:"color-bit",vertex:{header:`
            @in aColor: vec4<f32>;
        `,main:`
            vColor *= vec4<f32>(aColor.rgb * aColor.a, aColor.a);
        `}},ao={name:"color-bit",vertex:{header:`
            in vec4 aColor;
        `,main:`
            vColor *= vec4(aColor.rgb * aColor.a, aColor.a);
        `}},S={};function V(e){const t=[];{let o=0;for(let r=0;r<e;r++)t.push(`@group(1) @binding(${o++}) var textureSource${r+1}: texture_2d<f32>;`),t.push(`@group(1) @binding(${o++}) var textureSampler${r+1}: sampler;`)}return t.join(`
`)}function Z(e){const t=[];{t.push("switch vTextureId {");for(let o=0;o<e;o++)o===e-1?t.push("  default:{"):t.push(`  case ${o}:{`),t.push(`      outColor = textureSampleGrad(textureSource${o+1}, textureSampler${o+1}, vUV, uvDx, uvDy);`),t.push("      break;}");t.push("}")}return t.join(`
`)}function io(e){return S[e]||(S[e]={name:"texture-batch-bit",vertex:{header:`
                @in aTextureIdAndRound: vec2<u32>;
                @out @interpolate(flat) vTextureId : u32;
            `,main:`
                vTextureId = aTextureIdAndRound.y;
            `,end:`
                if(aTextureIdAndRound.x == 1)
                {
                    vPosition = vec4<f32>(roundPixels(vPosition.xy, globalUniforms.uResolution), vPosition.zw);
                }
            `},fragment:{header:`
                @in @interpolate(flat) vTextureId: u32;
    
                ${V(16)}
            `,main:`
                var uvDx = dpdx(vUV);
                var uvDy = dpdy(vUV);
    
                ${Z(16)}
            `}}),S[e]}const T={};function oo(e){const t=[];for(let o=0;o<e;o++)o>0&&t.push("else"),o<e-1&&t.push(`if(vTextureId < ${o}.5)`),t.push("{"),t.push(`	outColor = texture(uTextures[${o}], vUV);`),t.push("}");return t.join(`
`)}function co(e){return T[e]||(T[e]={name:"texture-batch-bit",vertex:{header:`
                in vec2 aTextureIdAndRound;
                out float vTextureId;
              
            `,main:`
                vTextureId = aTextureIdAndRound.y;
            `,end:`
                if(aTextureIdAndRound.x == 1.)
                {
                    gl_Position.xy = roundPixels(gl_Position.xy, uResolution);
                }
            `},fragment:{header:`
                in float vTextureId;
    
                uniform sampler2D uTextures[${e}];
              
            `,main:`
    
                ${oo(16)}
            `}}),T[e]}const so={name:"round-pixels-bit",vertex:{header:`
            fn roundPixels(position: vec2<f32>, targetSize: vec2<f32>) -> vec2<f32> 
            {
                return (floor((position * 0.5 + 0.5) * targetSize) / targetSize) * 2.0 - 1.0;
            }
        `}},lo={name:"round-pixels-bit",vertex:{header:`   
            vec2 roundPixels(vec2 position, vec2 targetSize)
            {       
                return (floor((position * 0.5 + 0.5) * targetSize) / targetSize) * 2.0 - 1.0;
            }
        `}},$={name:"local-uniform-bit",vertex:{header:`

            struct LocalUniforms {
                uTransformMatrix:mat3x3<f32>,
                uColor:vec4<f32>,
                uRound:f32,
            }

            @group(1) @binding(0) var<uniform> localUniforms : LocalUniforms;
        `,main:`
            vColor *= localUniforms.uColor;
            modelMatrix *= localUniforms.uTransformMatrix;
        `,end:`
            if(localUniforms.uRound == 1)
            {
                vPosition = vec4(roundPixels(vPosition.xy, globalUniforms.uResolution), vPosition.zw);
            }
        `}},uo={...$,vertex:{...$.vertex,header:$.vertex.header.replace("group(1)","group(2)")}},mo={name:"local-uniform-bit",vertex:{header:`

            uniform mat3 uTransformMatrix;
            uniform vec4 uColor;
            uniform float uRound;
        `,main:`
            vColor *= uColor;
            modelMatrix = uTransformMatrix;
        `,end:`
            if(uRound == 1.)
            {
                gl_Position.xy = roundPixels(gl_Position.xy, uResolution);
            }
        `}};class vo{constructor(){this.vertexSize=4,this.indexSize=6,this.location=0,this.batcher=null,this.batch=null,this.roundPixels=0}get blendMode(){return this.renderable.groupBlendMode}packAttributes(t,o,r,n){const c=this.renderable,a=this.texture,i=c.groupTransform,s=i.a,m=i.b,v=i.c,f=i.d,p=i.tx,d=i.ty,h=this.bounds,x=h.maxX,g=h.minX,b=h.maxY,C=h.minY,l=a.uvs,P=c.groupColorAlpha,U=n<<16|this.roundPixels&65535;t[r+0]=s*g+v*C+p,t[r+1]=f*C+m*g+d,t[r+2]=l.x0,t[r+3]=l.y0,o[r+4]=P,o[r+5]=U,t[r+6]=s*x+v*C+p,t[r+7]=f*C+m*x+d,t[r+8]=l.x1,t[r+9]=l.y1,o[r+10]=P,o[r+11]=U,t[r+12]=s*x+v*b+p,t[r+13]=f*b+m*x+d,t[r+14]=l.x2,t[r+15]=l.y2,o[r+16]=P,o[r+17]=U,t[r+18]=s*g+v*b+p,t[r+19]=f*b+m*g+d,t[r+20]=l.x3,t[r+21]=l.y3,o[r+22]=P,o[r+23]=U}packIndex(t,o,r){t[o]=r+0,t[o+1]=r+1,t[o+2]=r+2,t[o+3]=r+0,t[o+4]=r+2,t[o+5]=r+3}reset(){this.renderable=null,this.texture=null,this.batcher=null,this.batch=null,this.bounds=null}}function fo(e,t,o){const r=(e>>24&255)/255;t[o++]=(e&255)/255*r,t[o++]=(e>>8&255)/255*r,t[o++]=(e>>16&255)/255*r,t[o++]=r}export{vo as B,no as a,$ as b,ro as c,fo as d,eo as e,ao as f,io as g,co as h,lo as i,mo as j,uo as l,so as r};
