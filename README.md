# 🚦 signal-gl

![GitHub package.json version (subfolder of monorepo)](https://img.shields.io/github/package-json/v/bigmistqke/signal-gl)
![Maintained with pnpm](https://img.shields.io/badge/maintained_with-pnpm-%23cc01ff)

`minimal` `inline` `reactive` `glsl` `auto-binding` `signals` `no boilerplate` `tag template literals`

## Overview

- [Premise](#premise)  
- [Bindings](#bindings)
- [Install](#install)
- [Use it](#use-it)
- [API](#api)
  - [glsl](#glsl-tag-template-literal)
  - [uniform](#uniform-utility)
  - [attribute](#attribute-utility)
  - [GL](#gl-component)
  - [Program](#program-component) 

## Premise

- `Minimal` abstraction
- Co-locating `js` and `glsl`
- Composition of `glsl` snippets
- Lessen boilerplate with `auto-binding` uniforms and attributes
- `Purely runtime`: no additional build tools
- Small footprint: `2.5kb minified + gzip`

## Bindings

Currently there are only `solid` bindings, but the dependency on `solid` is minimal. If this idea has any merit it would be trivial to make bindings for other signal implementations.

## Install

```bash
npm i @bigmistqke/signal-gl
# or
pnpm i @bigmistqke/signal-gl
# or
yarn add @bigmistqke/signal-gl
```

## Use it

### Hello World [[playground]](https://playground.solidjs.com/anonymous/72a268af-262d-4d9a-84e4-4d60c94157b3)

<video alt="screenrecording first example" src="https://github.com/bigmistqke/signal.gl/assets/10504064/e306b06e-1b74-4f83-870c-f371c054b6f2">
  <img src="https://github.com/bigmistqke/signal.gl/assets/10504064/30b0c5ad-fd5d-4a58-812e-24734a43c52d"/>
</video>

```tsx
import { createSignal } from 'solid-js'
import { render } from 'solid-js/web'
import { GL, attribute, glsl, uniform } from '@bigmistqke/signal-gl'

function App() {
  const [vertices] = createSignal(
    new Float32Array([
      -1.0, -1.0, 1.0, -1.0, -1.0, 1.0, 1.0, -1.0, 1.0, 1.0, -1.0, 1.0,
    ]),
    { equals: false }
  )
  const [opacity, setOpacity] = createSignal(0.5)

  const fragment = glsl`#version 300 es
    precision mediump float;
    in vec2 v_coord; 
    out vec4 outColor;
    void main() {
      float opacity = ${uniform.float(opacity)};
      outColor = vec4(v_coord[0], v_coord[1], v_coord[0], opacity);
    }`

  const vertex = glsl`#version 300 es
    out vec2 v_coord;  
    out vec3 v_color;
    void main() {
      vec2 a_coord = ${attribute.vec2(vertices)};
      v_coord = a_coord;
      gl_Position = vec4(a_coord, 0, 1) ;
    }`

  return (
    <GL
      style={{
        width: '100vw',
        height: '100vh',
      }}
      onMouseMove={(e) => setOpacity(e.clientY / e.currentTarget.offsetHeight)}
    >
      <Program fragment={fragment} vertex={vertex} mode="TRIANGLES" />
    </GL>
  )
}

render(() => <App />, document.getElementById('app')!)
```

### Scope and Modules [[playground]](https://playground.solidjs.com/anonymous/d0770ee9-2045-464f-8b71-33493bba53d8)

<video alt="screenrecording second example" src="https://github.com/bigmistqke/signal.gl/assets/10504064/bad12fc1-45bf-4b8d-82a0-7cdb3e438a73">
  <img src="https://github.com/bigmistqke/signal.gl/assets/10504064/80b5b147-9a18-4352-a243-1778d91715e4"/>
</video>

```tsx
import { createSignal } from 'solid-js'
import { render } from 'solid-js/web'

import { GL, attribute, glsl, uniform } from '@bigmistqke/signal-gl'

function App() {
  const [cursor, setCursor] = createSignal<[number, number]>([1, 1])
  const [vertices] = createSignal(
    new Float32Array([
      -1.0, -1.0, 1.0, -1.0, -1.0, 1.0, 1.0, -1.0, 1.0, 1.0, -1.0, 1.0,
    ])
  )

  const [colors, setColors] = createSignal(
    new Float32Array(new Array(6 * 3).fill('').map((v) => Math.random())),
    { equals: false }
  )

  setInterval(() => {
    setColors((colors) => {
      colors[0] += 0.001
      colors[10] += 0.002

      if (colors[0] > 1) colors[0] = 0
      if (colors[10] > 1) colors[10] = 0

      return colors
    })
  })

  const module = glsl`
    // variable names can be scoped by interpolating strings
    // useful in glsl-module to prevent name collisions
    float ${'getLength'}(float x, float y){
      return length(x - y);
    }

    vec4 getColor(vec3 color, vec2 coord){
      vec2 cursor = ${uniform.vec2(cursor)};

      float lengthX = ${'getLength'}(cursor.x, coord.x);
      float lengthY = ${'getLength'}(cursor.y, coord.y);

      if(lengthX < 0.25 && lengthY < 0.25){
        return vec4(1. - color, 1.0);
      }else{
        return vec4(color, 1.0);
      }
    }`

  const fragment = glsl`#version 300 es
    precision mediump float;
    // compose shaders with interpolation
    ${module}

    in vec2 v_coord; 
    in vec3 v_color;
    out vec4 outColor;

    void main() {
      outColor = getColor(v_color, v_coord);
    }`

  const vertex = glsl`#version 300 es

    out vec2 v_coord;  
    out vec3 v_color;

    void main() {
      vec2 a_coord = ${attribute.vec2(vertices)};
      v_color = ${attribute.vec3(colors)};
      v_coord = a_coord - ${uniform.vec2(cursor)};
      gl_Position = vec4(a_coord, 0, 1) ;
    }`

  return (
    <GL
      style={{
        width: '100vw',
        height: '100vh',
      }}
      onMouseMove={(e) => {
        const x = e.clientX / e.currentTarget.clientWidth - 0.5
        const y =
          (e.currentTarget.clientHeight - e.clientY) /
            e.currentTarget.clientHeight -
          0.5
        setCursor([x, y])
      }}
    >
      <Program fragment={fragment} vertex={vertex} mode="TRIANGLES" />
    </GL>
  )
}

render(() => <App />, document.getElementById('app')!)
```

## API

### `glsl`: tag template literal

```ts
glsl`#version 300 es
${module}
out vec2 v_coord;  
out vec3 v_color;
float ${'scoped-var'} = 0.5;
void main() {
  vec2 a_coord = ${attribute.vec2(vertices)};
  vec2 cursor = ${uniform.vec2(cursor)};
  v_coord = a_coord * ${'scoped-var'} + cursor;
  gl_Position = vec4(a_coord, 0, 1) ;
}`
```

allowed interpolation-types:
- `AttributeToken`
  - `${attribute.float(...)}`
  - auto-binds a signal to an attribute
- `UniformToken`
  - `${uniform.float(...)}`
  - auto-bind a signal to a uniform
- `ShaderToken`
  - `${glsl``}`
  - compose shaders
- `string`
  - `${'scoped-var'}`
  - scope variable name to prevent name-collisions

### `uniform`: utility

```ts
uniform.float(signal as Accessor<number>, {} as UniformOptions)
uniform.int  (signal as Accessor<number>, {} as UniformOptions)
uniform.bool (signal as Accessor<boolean>, {} as UniformOptions)
uniform.vec2 (signal as Accessor<[number, number]>, {} as UniformOptions)
uniform.ivec2(signal as Accessor<[number, number]>, {} as UniformOptions)
uniform.bvec2(signal as Accessor<[boolean, boolean]>, {} as UniformOptions)
uniform.vec3 (signal as Accessor<[number, number, number]>, {} as UniformOptions)
uniform.ivec3(signal as Accessor<[number, number, number]>, {} as UniformOptions)
uniform.bvec3(signal as Accessor<[boolean, boolean, boolean]>, {} as UniformOptions)
uniform.vec4 (signal as Accessor<[number, number, number, number]>, {} as UniformOptions)
uniform.ivec4(signal as Accessor<[number, number, number, number]>, {} as UniformOptions)
uniform.bvec4(signal as Accessor<[boolean, boolean, boolean, boolean]>, {} as UniformOptions)
```

```ts
export type UniformOptions = {
  name?: string
}
```

returns a `UniformToken`

### `attribute`: utility

```ts
attribute.float(signal as Accessor<ArrayBufferView>, {} as AttributeOptions)
attribute.int  (signal as Accessor<ArrayBufferView>, {} as AttributeOptions)
attribute.bool (signal as Accessor<ArrayBufferView>, {} as AttributeOptions)
attribute.vec2 (signal as Accessor<ArrayBufferView>, {} as AttributeOptions)
attribute.ivec2(signal as Accessor<ArrayBufferView>, {} as AttributeOptions)
attribute.bvec2(signal as Accessor<ArrayBufferView>, {} as AttributeOptions)
attribute.vec3 (signal as Accessor<ArrayBufferView>, {} as AttributeOptions)
attribute.ivec3(signal as Accessor<ArrayBufferView>, {} as AttributeOptions)
attribute.bvec3(signal as Accessor<ArrayBufferView>, {} as AttributeOptions)
attribute.vec4 (signal as Accessor<ArrayBufferView>, {} as AttributeOptions)
attribute.ivec4(signal as Accessor<ArrayBufferView>, {} as AttributeOptions)
attribute.bvec4(signal as Accessor<ArrayBufferView>, {} as AttributeOptions)
```

```ts
export type AttributeOptions = {
  name?: string
  target?:
    | 'ARRAY_BUFFER'
    | 'ELEMENT_ARRAY_BUFFER'
    | 'COPY_READ_BUFFER'
    | 'COPY_WRITE_BUFFER'
    | 'TRANSFORM_FEEDBACK_BUFFER'
    | 'UNIFORM_BUFFER'
    | 'PIXEL_PACK_BUFFER'
    | 'PIXEL_UNPACK_BUFFER'
}
```

returns an `AttributeToken`

### `GL`: component

```tsx
<GL {...props as GLProps}>
  ...
</GL>
```

```ts
type GLProps =
  ComponentProps<'canvas'> & {
    onRender?: (gl: WebGL2RenderingContext, program: WebGLProgram) => void
    onInit?: (gl: WebGL2RenderingContext, program: WebGLProgram) => void
    animate?: boolean
  }
```

- root-element

### `Program`: component

```tsx
<Program fragment={glsl`...`} vertex={glsl`...`} mode='TRIANGLES'/>
```

```ts
type ProgramProps = {
  fragment: Accessor<ShaderToken>
  vertex: Accessor<ShaderToken>
  mode: 'TRIANGLES' | 'LINES' | 'POINTS'
}
```

- has to be sibling of `GL`


## `💡` Tip

<img width="417" alt="signal-gl code with syntax highlighting" src="https://github.com/bigmistqke/signal.gl/assets/10504064/d2027993-31ac-4c88-8f7f-c0b6f51d992c">

> use in combination with tag template literal syntax highlighting.<br/> > `vs-code` [glsl-literal syntax higlighting](https://marketplace.visualstudio.com/items?itemName=boyswan.glsl-literal)
