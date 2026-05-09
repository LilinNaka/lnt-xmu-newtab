// ==UserScript==
// @name         lnt.xmu.edu.cn 新标签页打开
// @namespace    https://github.com/LilinNaka/lnt-xmu-newtab
// @version      6.2
// @description  多策略 URL 发现：AngularJS scope + Vue 课程卡片 + Vue 任务列表 + <a> + onclick + data-*
// @match        *://lnt.xmu.edu.cn/*
// @run-at       document-end
// @author       狄朴思
// @grant        none
// ==/UserScript==

(function () {
  'use strict';

  if (window.__lntNewTab) return;
  window.__lntNewTab = true;

  // ─── Finder 1: AngularJS scope（课程详情页活动导航）────────────────

  function findActivity(element) {
    var walk = element;
    while (walk && walk !== document.documentElement) {
      try {
        var s = angular.element(walk).scope();
        if (s) {
          if (s.activity && s.activity.id) return s.activity;
          var child = s.$$childHead;
          while (child) {
            if (child.activity && child.activity.id) return child.activity;
            child = child.$$nextSibling;
          }
        }
        var iso = angular.element(walk).isolateScope();
        if (iso) {
          if (iso.activity && iso.activity.id) return iso.activity;
          var child = iso.$$childHead;
          while (child) {
            if (child.activity && child.activity.id) return child.activity;
            child = child.$$nextSibling;
          }
        }
      } catch (_) {}
      walk = walk.parentElement;
    }
    return null;
  }

  function buildActivityUrl(element, activity) {
    var walk = element;
    while (walk && walk !== document.documentElement) {
      try {
        var s = angular.element(walk).scope();
        if (s && s.course && s.course.id) return '/course/' + s.course.id + '/learning-activity#' + activity.id;
      } catch (_) {}
      walk = walk.parentElement;
    }
    return null;
  }

  // ─── Finder 2: Vue 2 __vue__（用户首页课程卡片导航）────────────────

  function findCourseFromVue(element) {
    var card = element.closest('.course-card');
    if (!card) return null;
    var wrapper = card.parentElement;
    if (!wrapper) return null;
    var sem = element.closest('.semester-courses');
    if (!sem || !sem.__vue__ || !sem.__vue__.courses) return null;
    var idx = Array.prototype.indexOf.call(wrapper.children, card);
    if (idx < 0 || idx >= sem.__vue__.courses.length) return null;
    return sem.__vue__.courses[idx];
  }

  // ─── Finder 3: Vue study-tasks（课程首页的任务导航）─────────────────

  function findTaskFromVue(element) {
    var taskTitle = element.closest('.task-title');
    if (!taskTitle) return null;
    var study = element.closest('.study-tasks');
    if (!study || !study.__vue__ || !study.__vue__.displayGroup) return null;
    var dg = study.__vue__.displayGroup;
    var allTasks = (dg.ongoing || []).concat(dg.completed || []);
    var text = (taskTitle.textContent || '').trim();
    for (var i = 0; i < allTasks.length; i++) {
      if (allTasks[i].title === text) return allTasks[i];
    }
    return null;
  }

  function findCourseIdFromParentVue(element) {
    var walk = element;
    while (walk) {
      if (walk.__vue__) {
        var parent = walk.__vue__.$parent;
        while (parent) {
          if (parent.course && parent.course.id) return parent.course.id;
          parent = parent.$parent;
        }
      }
      walk = walk.parentElement;
    }
    return null;
  }

  // ─── Finder 4: 通用 DOM 回退 ──────────────────────────────────────

  function findUrlFromAnchor(element) {
    var anchor = element.closest('a');
    if (!anchor) return null;
    var href = anchor.href;
    if (!href || /^(javascript|mailto|tel):/i.test(href)) return null;
    try {
      var u = new URL(href, location.href);
      if (u.hostname !== 'lnt.xmu.edu.cn' && !u.hostname.endsWith('.lnt.xmu.edu.cn')) return null;
      return href;
    } catch (_) { return null; }
  }

  function findUrlFromOnclick(element) {
    var walk = element;
    while (walk && walk !== document.documentElement) {
      var onclick = walk.getAttribute('onclick');
      if (onclick) {
        var m = onclick.match(/location\.(?:href|assign|replace)\s*[=(]\s*['"]([^'"]+)['"]/);
        if (m) return m[1];
        m = onclick.match(/window\.open\s*\(\s*['"]([^'"]+)['"]/);
        if (m) return m[1];
      }
      walk = walk.parentElement;
    }
    return null;
  }

  function findUrlFromDataAttrs(element) {
    var walk = element;
    while (walk && walk !== document.documentElement) {
      var url = walk.getAttribute('data-href') || walk.getAttribute('data-url') || walk.getAttribute('data-link');
      if (url) {
        try {
          var u = new URL(url, location.href);
          if (u.hostname === 'lnt.xmu.edu.cn' || u.hostname.endsWith('.lnt.xmu.edu.cn')) return url;
        } catch (_) { return null; }
      }
      walk = walk.parentElement;
    }
    return null;
  }

  // ─── 事件拦截 ───────────────────────────────────────────────────

  function handleClick(e) {
    if (e.button !== 0) return;

    var url;
    var target = e.target;

    // 1. AngularJS activity
    var activity = findActivity(target);
    if (activity) {
      url = buildActivityUrl(target, activity);
    }

    // 2. Vue course card
    if (!url) {
      var course = findCourseFromVue(target);
      if (course && course.url) url = course.url;
    }

    // 3. Vue study-tasks
    if (!url) {
      var task = findTaskFromVue(target);
      if (task && task.id) {
        var cid = findCourseIdFromParentVue(target);
        if (cid) url = '/course/' + cid + '/learning-activity#' + task.id;
      }
    }

    // 4. <a> 标签
    if (!url) {
      console.log('[lnt] Finder4 e.target:', e.target.tagName, e.target.className.slice(0,60));
      var anchor = target.closest('a');
      console.log('[lnt] Finder4 anchor:', anchor ? anchor.tagName + ' ' + anchor.className + ' href=' + anchor.href : 'null');
      url = findUrlFromAnchor(target);
    }

    // 5. onclick 属性
    if (!url) url = findUrlFromOnclick(target);

    // 6. data-* 属性
    if (!url) url = findUrlFromDataAttrs(target);

    if (url) {
      var newTab = window.open(url, '_blank');
      if (newTab) {
        e.stopPropagation();
        e.preventDefault();
      }
    }
  }

  // ─── 初始化 ───────────────────────────────────────────────────────

  window.addEventListener('click', handleClick, true);
})();
