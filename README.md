# lnt.xmu.edu.cn 正向新标签页

Tampermonkey 用户脚本。点击 `lnt.xmu.edu.cn` 上的内部链接时，在新标签页打开目标页面，当前页保持不变。

## 效果

- 用户首页：课程卡片 → 新标签页打开
- 用户首页：待办快捷入口（.todo-link）→ 新标签页打开
- 课程详情页：课件/任务列表 → 新标签页打开
- 课程首页：任务列表（板书/作业/测试等） → 新标签页打开
- 其他：有 `<a href>` 的链接正常工作

## 原理

网站用 AngularJS 指令和 Vue 组件通过 JS 控制 `location.href`，但浏览器对 `location` 对象的保护使 `location.href = url` 无法被用户脚本拦截。

在 click 事件的 window capture 阶段，从框架内部状态（AngularJS `angular.element(el).scope()`、Vue 2 `el.__vue__`）读取目标 URL，然后 `window.open(url, '_blank')` + `stopPropagation()` + `preventDefault()`。

## 安装

1. 安装 [Tampermonkey](https://www.tampermonkey.net/)
2. 把 `lnt-xmu-forward-tab.user.js` 内容粘贴到 Tampermonkey 新脚本
3. 刷新 `lnt.xmu.edu.cn`

## 踩过的坑

| 问题 | 说明 |
|------|------|
| `location.href = url` 拦不住 | 浏览器保护了 Location 对象，用户脚本无法覆盖 |
| `preventDefault` 拦不住 JS 主动导航 | 网站在 click handler 里直接写 `location.href`，preventDefault 吃不到 |
| `hashchange` 不触发 | 网站是整页导航，不是 SPA 路由变化 |
| Vue 和 AngularJS 混在一起 | 没有统一读取入口，只能逐个页面类型挖掘 |
| 网站不用 `<a>` 标签 | 所有导航都是 `<div>` + JS onclick，右键没有"在新标签页打开" |

## 关于 todo-link 的查找过程

用户首页的待办快捷入口（`.todo-link`）是 `<a>` 标签，包含在 `.todo-item` 里。点击时，实际触发的是 SPAN 上的事件，事件冒泡到父级后由 Vue 的事件委托处理。

排查过程耗时很长，因为：
1. SPAN 的 DOM 祖先链里没有 `<a>` 标签——`<a class="todo-link">` 和 SPAN 是 `.todo-item` 下的兄弟节点，不是父子关系
2. `closest('a')` 在 SPAN 上始终返回 null，因为 `<a>` 不是 SPAN 的祖先
3. 需要手动从 `.todo-item` 的 children 里查找 `<a class="todo-link">`，而不是用 `closest()`

## 多策略 Finder 优先级

1. AngularJS scope → `activity.id` + `course.id` → `/course/{id}/learning-activity#{aid}`
2. Vue `.course-card` → `SemesterCourses.courses[n].url`
3. Vue `.study-tasks` → `displayGroup.ongoing[n].id` → `/course/{id}/learning-activity#{tid}`
4. `<a>` 标签
5. onclick 属性
6. Vue `.todo-item` → 找兄弟 `<a class="todo-link">`（Vue 事件委托，`<a>` 不在点击元素的祖先链上）
7. data-* 属性

## 协议

CC BY-NC 4.0
