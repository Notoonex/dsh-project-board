window.__ModuleLoader__.load({
  id: 'dsh-project-board',
  factory: (require) => {
    const React = require('react');
    const h = React.createElement;

    const API_PORTS = Array.from({ length: 10 }, (_, i) => 8791 + i);
    let apiBasePromise = null;

    async function getApiBase() {
      if (apiBasePromise) return apiBasePromise;
      apiBasePromise = (async () => {
        if (typeof window !== 'undefined' && window.__PROJECT_BOARD_API__) {
          return window.__PROJECT_BOARD_API__;
        }
        for (const port of API_PORTS) {
          const base = `http://127.0.0.1:${port}`;
          try {
            const controller = new AbortController();
            const timer = setTimeout(() => controller.abort(), 250);
            const res = await fetch(`${base}/api/health`, { signal: controller.signal });
            clearTimeout(timer);
            if (!res.ok) continue;
            const data = await res.json();
            if (data && data.app === 'dsh-project-board') return base;
          } catch {}
        }
        return 'http://127.0.0.1:8791';
      })();
      return apiBasePromise;
    }
    const TAB_ID = 'dsh-project-board';
    const TAB_KIND = 'project-board';
    const TOKEN = '__PROJECT_BOARD_TOKEN__';
    const authHeaders = () => ({ 'X-Project-Board-Token': TOKEN });

    // ── icons ────────────────────────────────────────────────────────────────
    function IconKanban({ size = 26, className }) {
      return h('svg', {
        width: size, height: size, viewBox: '0 0 24 24', fill: 'none', className,
        style: { flex: 'none', display: 'inline-block' }
      },
        h('rect', { x: 3, y: 3, width: 18, height: 18, rx: 3, stroke: '#34C759', strokeWidth: 2 }),
        h('path', { d: 'M8 7v6', stroke: '#34C759', strokeWidth: 2, strokeLinecap: 'round' }),
        h('path', { d: 'M12 7v10', stroke: '#34C759', strokeWidth: 2, strokeLinecap: 'round' }),
        h('path', { d: 'M16 7v4', stroke: '#34C759', strokeWidth: 2, strokeLinecap: 'round' })
      );
    }

    function IconRefresh({ size = 13, spinning = false }) {
      return h('svg', {
        width: size, height: size, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor',
        strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round',
        style: { flex: 'none', display: 'inline-block', transition: 'transform .4s ease', transform: spinning ? 'rotate(360deg)' : 'none' }
      },
        h('path', { d: 'M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8' }),
        h('path', { d: 'M3 3v5h5' }),
        h('path', { d: 'M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16' }),
        h('path', { d: 'M16 21h5v-5' })
      );
    }

    function IconChevron({ className }) {
      return h('svg', {
        className, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor',
        strokeWidth: 2.2, strokeLinecap: 'round', strokeLinejoin: 'round'
      }, h('path', { d: 'm9 6 6 6-6 6' }));
    }

    function IconSearch() {
      return h('svg', {
        width: 12, height: 12, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor',
        strokeWidth: 2.4, strokeLinecap: 'round'
      }, h('circle', { cx: 11, cy: 11, r: 7 }), h('path', { d: 'm20 20-3.5-3.5' }));
    }

    function IconClose() {
      return h('svg', {
        width: 12, height: 12, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor',
        strokeWidth: 2.4, strokeLinecap: 'round'
      }, h('path', { d: 'M6 6l12 12M18 6L6 18' }));
    }

    function IconCheck() {
      return h('svg', {
        viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor',
        strokeWidth: 4, strokeLinecap: 'round', strokeLinejoin: 'round'
      }, h('path', { d: 'm5 13 4 4L19 7' }));
    }

    // ── styles ───────────────────────────────────────────────────────────────
    const CSS = `
      .kgb-root{
        --kgb-text:var(--dsw-alias-label-primary,currentColor);
        --kgb-text2:var(--dsw-alias-label-secondary,currentColor);
        --kgb-text3:var(--dsw-alias-label-tertiary,currentColor);
        --kgb-bg:var(--dsw-alias-bg-base,#fff);
        --kgb-surface:var(--dsw-alias-bg-layer-2,var(--dsw-alias-bg-base,#fff));
        --kgb-border:var(--dsw-alias-border-l3,rgba(125,125,125,.18));
        --kgb-hover:var(--dsw-alias-interactive-bg-hover,rgba(125,125,125,.08));
        display:flex;flex-direction:column;width:100%;height:100%;min-height:0;overflow:hidden;position:relative;
        font-family:-apple-system,BlinkMacSystemFont,"SF Pro Text","PingFang SC","Helvetica Neue",sans-serif;
        color:var(--kgb-text);background:transparent}
      .kgb-top{display:flex;align-items:center;gap:8px;padding:8px 10px;border-bottom:1px solid var(--kgb-border);
        background:var(--kgb-hover);flex:none}
      .kgb-select{flex:1;min-width:0;height:26px;padding:0 8px;font-size:12px;font-weight:500;border-radius:6px;
        border:1px solid var(--kgb-border);background:var(--kgb-surface);color:var(--kgb-text);outline:none;cursor:pointer}
      .kgb-select option{background:var(--kgb-bg);color:var(--kgb-text)}
      .kgb-icon{display:inline-flex;align-items:center;justify-content:center;width:26px;height:26px;border:0;border-radius:6px;
        background:transparent;color:var(--kgb-text2);cursor:pointer}
      .kgb-icon:hover{background:var(--kgb-hover)}
      .kgb-info{padding:9px 11px 8px;border-bottom:1px solid var(--kgb-border);flex:none}
      .kgb-info-row{display:flex;justify-content:space-between;align-items:baseline;font-size:11px;margin-bottom:6px}
      .kgb-info-row b{font-size:12px;font-weight:650;color:var(--kgb-text)}
      .kgb-info-row span{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:10px;color:var(--kgb-text3)}
      .kgb-bar{height:5px;border-radius:999px;background:var(--kgb-border);overflow:hidden}
      .kgb-fill{height:100%;border-radius:999px;background:#34c759;transition:width .25s}
      .kgb-tabs{display:flex;gap:3px;padding:6px 10px;border-bottom:1px solid var(--kgb-border);flex:none}
      .kgb-tab{flex:1;height:26px;border:0;border-radius:6px;background:transparent;color:var(--kgb-text2);
        font-size:11.5px;font-weight:500;cursor:pointer;font-family:inherit;display:flex;align-items:center;justify-content:center;gap:4px}
      .kgb-tab.on{background:var(--kgb-bg);color:var(--kgb-text);box-shadow:0 1px 3px rgba(0,0,0,.14);font-weight:600}
      .kgb-tab .n{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:10px;color:var(--kgb-text3)}
      .kgb-search{padding:8px 10px 6px;flex:none}
      .kgb-si{position:relative}
      .kgb-si svg{position:absolute;left:7px;top:7px;color:var(--kgb-text3);pointer-events:none}
      .kgb-si input{width:100%;height:27px;border-radius:6px;border:1px solid var(--kgb-border);
        background:var(--kgb-surface);padding:0 8px 0 25px;font-size:11.5px;color:var(--kgb-text);outline:none;font-family:inherit;box-sizing:border-box}
      .kgb-si input::placeholder{color:var(--kgb-text3)}
      .kgb-si input:focus{border-color:rgba(10,132,255,.5);background:var(--kgb-bg);box-shadow:0 0 0 3px rgba(10,132,255,.12)}
      .kgb-chips{display:flex;gap:5px;padding:0 10px 8px;overflow-x:auto;scrollbar-width:none;flex:none;
        -webkit-mask-image:linear-gradient(to right,#000 0,#000 calc(100% - 18px),transparent 100%)}
      .kgb-chips::-webkit-scrollbar{display:none}
      .kgb-chip{flex:none;border:1px solid var(--kgb-border);background:transparent;
        color:var(--kgb-text2);font-size:10.5px;padding:3px 8px;border-radius:999px;cursor:pointer;
        white-space:nowrap;font-family:inherit}
      .kgb-chip:hover{border-color:var(--kgb-text3)}
      .kgb-chip.on{background:var(--kgb-text);border-color:transparent;color:var(--kgb-bg)}
      .kgb-chip .n{margin-left:4px;color:inherit;opacity:.55;font-family:ui-monospace,SFMono-Regular,Menlo,monospace}
      .kgb-list{flex:1;min-height:0;overflow-y:auto;padding:2px 6px 10px}
      .kgb-node{margin-bottom:1px}
      .kgb-head{width:100%;display:flex;align-items:center;gap:6px;padding:6px;border:0;background:transparent;border-radius:6px;
        cursor:pointer;font-family:inherit;text-align:left;color:var(--kgb-text)}
      .kgb-head:hover{background:var(--kgb-hover)}
      .kgb-chev{width:12px;height:12px;flex:none;color:var(--kgb-text3);transition:transform .18s}
      .kgb-node.open .kgb-chev{transform:rotate(90deg)}
      .kgb-num{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:9.5px;color:var(--kgb-text3);width:16px;flex:none}
      .kgb-name{font-size:12px;font-weight:600;flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
      .kgb-count{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:9.5px;color:var(--kgb-text3)}
      .kgb-dot{width:6px;height:6px;border-radius:50%;flex:none}
      .kgb-body{display:grid;grid-template-rows:0fr;transition:grid-template-rows .2s ease}
      .kgb-node.open .kgb-body{grid-template-rows:1fr}
      .kgb-inner{overflow:hidden}
      .kgb-scope{font-size:10.5px;color:var(--kgb-text3);padding:1px 6px 4px 34px;line-height:1.4}
      .kgb-item{display:flex;align-items:flex-start;gap:7px;padding:4px 6px 4px 34px;border-radius:5px;font-size:11.5px;
        line-height:1.45;cursor:pointer;color:var(--kgb-text)}
      .kgb-item:hover{background:var(--kgb-hover)}
      .kgb-box{width:13px;height:13px;border-radius:3.5px;border:1.5px solid var(--kgb-text3);flex:none;margin-top:1px;
        display:grid;place-items:center;transition:all .15s}
      .kgb-box svg{width:8px;height:8px;opacity:0;color:#fff}
      .kgb-item.done .kgb-box{background:#34c759;border-color:#34c759}
      .kgb-item.done .kgb-box svg{opacity:1}
      .kgb-txt{flex:1;min-width:0;word-break:break-word}
      .kgb-item.done .kgb-txt{color:var(--kgb-text3);text-decoration:line-through}
      .kgb-meta{display:flex;gap:4px;margin-top:2px;flex-wrap:wrap}
      .kgb-tag{font-size:9px;padding:1px 5px;border-radius:4px;font-weight:600;letter-spacing:.02em}
      .kgb-tag.pending{background:rgba(255,149,0,.16);color:#b26a00;color:color-mix(in srgb,#ff9500 48%,var(--kgb-text))}
      .kgb-tag.green{background:rgba(52,199,89,.16);color:#248a3d;color:color-mix(in srgb,#34c759 48%,var(--kgb-text))}
      .kgb-tag.gray{background:rgba(142,142,147,.16);color:var(--kgb-text2)}
      .kgb-tag.link{background:rgba(10,132,255,.12);color:#0a6ccc;color:color-mix(in srgb,#0a84ff 48%,var(--kgb-text));font-family:ui-monospace,SFMono-Regular,Menlo,monospace;cursor:pointer}
      .kgb-done-row{padding:2px 6px 4px 34px}
      .kgb-done-btn{border:0;background:transparent;color:var(--kgb-text3);font-size:10.5px;cursor:pointer;font-family:inherit;padding:2px 0}
      .kgb-done-btn:hover{color:var(--kgb-text)}
      .kgb-dec{padding:6px 6px 6px 34px;border-radius:6px;cursor:pointer;color:var(--kgb-text)}
      .kgb-dec:hover{background:var(--kgb-hover)}
      .kgb-dec-top{display:flex;align-items:center;gap:5px;margin-bottom:1px}
      .kgb-dec-id{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:10px;font-weight:600;
        color:#0a6ccc;color:color-mix(in srgb,#0a84ff 52%,var(--kgb-text))}
      .kgb-dec-title{font-size:11.5px;line-height:1.4;color:var(--kgb-text)}
      .kgb-dec-meta{font-size:9.5px;color:var(--kgb-text3);margin-top:1px;font-family:ui-monospace,SFMono-Regular,Menlo,monospace}
      .kgb-foot{display:flex;align-items:center;gap:8px;padding:6px 10px;border-top:1px solid var(--kgb-border);
        flex:none;font-size:10.5px;min-height:30px;color:var(--kgb-text2)}
      .kgb-switch{display:flex;align-items:center;gap:5px;border:0;background:transparent;color:var(--kgb-text2);font-family:inherit;
        font-size:10.5px;cursor:pointer;padding:0}
      .kgb-mini{width:24px;height:14px;border-radius:999px;background:var(--kgb-border);position:relative;transition:background .15s;display:inline-block}
      .kgb-mini::after{content:"";position:absolute;top:2px;left:2px;width:10px;height:10px;border-radius:50%;background:#fff;
        transition:left .15s;box-shadow:0 1px 2px rgba(0,0,0,.2)}
      .kgb-mini.on{background:#34c759}
      .kgb-mini.on::after{left:12px}
      .kgb-expand-btn{border:0;background:transparent;color:var(--kgb-text2);font-family:inherit;font-size:10.5px;cursor:pointer;
        padding:2px 6px;border-radius:4px;display:inline-flex;align-items:center;gap:3px;transition:all .15s ease}
      .kgb-expand-btn:hover{background:var(--kgb-hover);color:var(--kgb-text)}
      .kgb-spacer{flex:1}
      .kgb-dim{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:9.5px;color:var(--kgb-text3)}
      .kgb-pills{display:flex;gap:2px}
      .kgb-pill{border:0;background:transparent;color:var(--kgb-text2);font-size:10px;padding:2px 6px;border-radius:4px;cursor:pointer;
        font-family:inherit}
      .kgb-pill.on{background:var(--kgb-hover);color:var(--kgb-text);font-weight:600}
      .kgb-empty{padding:24px 16px;text-align:center;font-size:11px;color:var(--kgb-text3);line-height:1.5}
      .kgb-backdrop{position:absolute;inset:0;background:rgba(0,0,0,.28);opacity:0;pointer-events:none;transition:opacity .2s;z-index:20}
      .kgb-backdrop.show{opacity:1;pointer-events:auto}
      .kgb-drawer{position:absolute;left:0;right:0;bottom:0;max-height:80%;background:var(--kgb-surface);
        color:var(--kgb-text);border-top:1px solid var(--kgb-border);border-radius:12px 12px 0 0;box-shadow:0 -8px 24px rgba(0,0,0,.24);transform:translateY(101%);
        transition:transform .24s cubic-bezier(.32,.72,0,1);z-index:21;display:flex;flex-direction:column}
      .kgb-drawer.show{transform:translateY(0)}
      .kgb-grip{width:30px;height:4px;border-radius:999px;background:var(--kgb-text3);opacity:.5;margin:6px auto 2px;flex:none}
      .kgb-dhead{padding:6px 14px 9px;border-bottom:1px solid var(--kgb-border);
        display:flex;gap:8px;align-items:flex-start;flex:none}
      .kgb-dbody{padding:10px 14px 16px;overflow-y:auto}
      .kgb-field{margin-bottom:9px}
      .kgb-field .k{font-size:9px;letter-spacing:.05em;color:var(--kgb-text3);font-weight:600;margin-bottom:2px;text-transform:uppercase}
      .kgb-field .v{font-size:11.5px;line-height:1.5;color:var(--kgb-text)}
      .kgb-field .v.mono{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:10.5px}
      .kgb-close{border:0;background:transparent;color:var(--kgb-text2);cursor:pointer;padding:4px;border-radius:4px}
      .kgb-close:hover{background:var(--kgb-hover)}
      .kgb-nchips{display:flex;gap:4px;flex-wrap:wrap}
      .kgb-nchip{font-size:10px;padding:2px 6px;border-radius:4px;background:rgba(10,132,255,.12);
        color:#0a6ccc;color:color-mix(in srgb,#0a84ff 52%,var(--kgb-text));cursor:pointer}
    `;

    // ── helpers ──────────────────────────────────────────────────────────────
    const cls = (...a) => a.filter(Boolean).join(' ');

    function dotColor(n) {
      if (n.pending > 0) return '#ff9500';
      if (n.open === 0) return '#34c759';
      return '#0a84ff';
    }

    function statusCls(d) {
      if (d.status === '待拍板') return 'pending';
      if (d.status === '已被取代' || d.status === '废弃') return 'gray';
      return 'green';
    }

    function groupDecisions(decData) {
      if (decData.groups && decData.groups.length) return decData.groups;
      const map = {};
      for (const it of (decData.items || [])) {
        const id = (it.node && it.node.id) || '00';
        const name = (it.node && it.node.name) || '未分组';
        if (!map[id]) map[id] = { id, name, items: [] };
        map[id].items.push(it);
      }
      return Object.values(map).sort((a, b) => a.id.localeCompare(b.id));
    }

    // ── component ────────────────────────────────────────────────────────────
    function NativeBoardTab() {
      const [project, setProject] = React.useState('');
      const [tabMode, setTabMode] = React.useState('board');
      const [payload, setPayload] = React.useState(null);
      const [decPayload, setDecPayload] = React.useState(null);
      const [loading, setLoading] = React.useState(true);
      const [decLoading, setDecLoading] = React.useState(false);
      const [error, setError] = React.useState(null);
      const [busy, setBusy] = React.useState(false);

      const [query, setQuery] = React.useState('');
      const [quick, setQuick] = React.useState(null);
      const [hideDone, setHideDone] = React.useState(false);
      const [expandedNodes, setExpandedNodes] = React.useState({});
      const [expandedDecMap, setExpandedDecMap] = React.useState({});
      const [doneOpen, setDoneOpen] = React.useState({});
      const [decStatus, setDecStatus] = React.useState('all');
      const [drawer, setDrawer] = React.useState(null);

      const rootRef = React.useRef(null);
      const didInitBoard = React.useRef(false);
      const didInitDec = React.useRef(false);

      const fetchBoard = React.useCallback(async (target) => {
        setLoading(true);
        setError(null);
        try {
          const q = target ? `?project=${encodeURIComponent(target)}` : '';
          const base = await getApiBase();
          const res = await fetch(`${base}/api/board${q}`, { headers: authHeaders() });
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          const data = await res.json();
          setPayload(data);
          if (data && data.project) setProject(data.project);
        } catch (e) {
          setError(e.message || '连接看板后台失败');
        } finally {
          setLoading(false);
        }
      }, []);

      const fetchDecisions = React.useCallback(async (target) => {
        setDecLoading(true);
        try {
          const q = target ? `?project=${encodeURIComponent(target)}` : '';
          const base = await getApiBase();
          const res = await fetch(`${base}/api/decisions${q}`, { headers: authHeaders() });
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          setDecPayload(await res.json());
        } catch (e) {
          console.warn('[dsh-project-board] 获取决策失败:', e);
        } finally {
          setDecLoading(false);
        }
      }, []);

      React.useEffect(() => {
        fetchBoard();
        fetchDecisions();
      }, [fetchBoard, fetchDecisions]);

      React.useEffect(() => {
        if (didInitBoard.current || !payload || !payload.nodes || !payload.nodes.length) return;
        const first = payload.nodes.slice().sort((a, b) => (b.open || 0) - (a.open || 0))[0] || payload.nodes[0];
        if (first) setExpandedNodes({ [first.id]: true });
        didInitBoard.current = true;
      }, [payload]);

      React.useEffect(() => {
        if (didInitDec.current || !decPayload || !decPayload.data || !decPayload.data.groups || !decPayload.data.groups.length) return;
        const g = decPayload.data.groups.find(x => x.items.some(i => i.status === '待拍板')) || decPayload.data.groups[0];
        if (g) setExpandedDecMap({ [g.id]: true });
        didInitDec.current = true;
      }, [decPayload]);

      const onSelectProject = (p) => {
        setProject(p);
        setExpandedNodes({});
        setExpandedDecMap({});
        setQuick(null);
        setQuery('');
        setDrawer(null);
        setDoneOpen({});
        setDecStatus('all');
        didInitBoard.current = false;
        didInitDec.current = false;
        fetchBoard(p);
        fetchDecisions(p);
      };

      const onRefreshCurrent = () => {
        if (tabMode === 'decisions') fetchDecisions(project);
        else fetchBoard(project);
      };

      const toggleItem = async (line, done, nodeId, text, id) => {
        if (busy) return;
        setBusy(true);

        setPayload(prev => {
          if (!prev) return prev;
          const nodes = (prev.nodes || []).map(n => ({
            ...n,
            items: n.items.map(it => {
              const match = it.line === line
                || (id && it.id === id)
                || (text && it.text === text && n.id === nodeId);
              return match ? { ...it, done } : it;
            })
          }));
          let total = 0, doneCount = 0;
          nodes.forEach(n => {
            n.total = n.items.length;
            n.done = n.items.filter(it => it.done).length;
            n.open = n.total - n.done;
            n.pending = n.items.filter(it => it.pending && !it.done).length;
            total += n.total;
            doneCount += n.done;
          });
          return {
            ...prev,
            nodes,
            stats: {
              total,
              done: doneCount,
              open: total - doneCount,
              percent: total > 0 ? Math.round((doneCount / total) * 100) : 0
            }
          };
        });

        try {
          const base = await getApiBase();
          const res = await fetch(`${base}/api/toggle`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'X-Project-Board-Token': TOKEN },
            body: JSON.stringify({ line, done, project, node: nodeId, text, id })
          });
          if (res.ok) setPayload(await res.json());
          else fetchBoard(project);
        } catch (e) {
          console.warn('[dsh-project-board] 写回失败:', e);
          fetchBoard(project);
        } finally {
          setBusy(false);
        }
      };

      const openDecision = (id) => {
        const item = (decPayload?.data?.items || []).find(x => x.id === id);
        if (item) setDrawer(item);
      };

      const jumpToNode = (id) => {
        setDrawer(null);
        setQuick(null);
        if (tabMode === 'board') setExpandedNodes(prev => ({ ...prev, [id]: true }));
        else setExpandedDecMap(prev => ({ ...prev, [id]: true }));
        requestAnimationFrame(() => {
          const el = rootRef.current && rootRef.current.querySelector(`.kgb-node[data-node="${id}"]`);
          if (el) el.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
        });
      };

      const stats = payload?.stats || { total: 0, done: 0, open: 0, percent: 0 };
      const nodes = payload?.nodes || [];
      const projects = payload?.projects || decPayload?.projects || [];
      const hasBoard = Boolean(payload?.has_board && nodes.length);
      const decData = decPayload?.data || { total: 0, pending: 0, settled: 0, superseded: 0, danger: 0, items: [], groups: [] };
      const hasDecisions = Boolean(decPayload?.has_decisions && decData.total > 0);
      const groups = React.useMemo(() => groupDecisions(decData), [decData]);
      const pendingTasks = nodes.reduce((s, n) => s + (n.pending || 0), 0);
      const q = query.trim().toLowerCase();

      const shownNodes = React.useMemo(() => {
        return nodes.map(n => {
          let items = n.items;
          if (q) items = items.filter(it => ((it.text || '') + ' ' + (it.link || '') + ' ' + n.name).toLowerCase().includes(q));
          if (quick === 'pending') items = items.filter(it => it.pending && !it.done);
          const open = items.filter(it => !it.done);
          const done = items.filter(it => it.done);
          return { ...n, _all: items, _open: open, _done: done };
        }).filter(n => {
          if (quick && quick !== 'pending') return n.id === quick && n._all.length > 0;
          if (q) return n._all.length > 0;
          if (hideDone) return n._open.length > 0;
          return n._all.length > 0;
        });
      }, [nodes, q, quick, hideDone]);

      const shownGroups = React.useMemo(() => {
        return groups.map(g => {
          let items = g.items;
          if (decStatus === 'active') items = items.filter(d => d.status === '生效');
          else if (decStatus === 'pending') items = items.filter(d => d.status === '待拍板');
          else if (decStatus === 'superseded') items = items.filter(d => d.status === '已被取代' || d.status === '废弃');
          if (quick && quick !== 'pending') items = items.filter(() => g.id === quick);
          if (q) items = items.filter(d => (d.id + ' ' + d.title + ' ' + (d.reason || '') + ' ' + g.name).toLowerCase().includes(q));
          return { ...g, _items: items };
        }).filter(g => g._items.length > 0);
      }, [groups, decStatus, quick, q]);

      const isOpen = (n) => Boolean(q) || quick === n.id || quick === 'pending' || Boolean(expandedNodes[n.id]);
      const isDecOpen = (g) => Boolean(q) || quick === g.id || decStatus === 'pending' || Boolean(expandedDecMap[g.id]);

      const allNodesOpen = shownNodes.length > 0 && shownNodes.every(n => expandedNodes[n.id]);
      const allDecsOpen = shownGroups.length > 0 && shownGroups.every(g => expandedDecMap[g.id]);

      const toggleExpandAllNodes = () => {
        if (allNodesOpen) {
          setExpandedNodes({});
        } else {
          const next = {};
          shownNodes.forEach(n => { next[n.id] = true; });
          setExpandedNodes(next);
        }
      };

      const toggleExpandAllDecs = () => {
        if (allDecsOpen) {
          setExpandedDecMap({});
        } else {
          const next = {};
          shownGroups.forEach(g => { next[g.id] = true; });
          setExpandedDecMap(next);
        }
      };

      const chips = tabMode === 'board'
        ? [
            { key: 'all', label: '全部', n: stats.open },
            { key: 'pending', label: '待拍板', n: pendingTasks, pending: true },
            ...nodes.filter(n => n.open > 0).map(n => ({ key: n.id, label: n.name, n: n.open }))
          ]
        : [
            { key: 'all', label: '全部', n: decData.total },
            ...groups.map(g => ({ key: g.id, label: g.name, n: g.items.length }))
          ];

      const onChip = (key) => {
        if (key === 'all') {
          setQuick(null);
          return;
        }
        if (key === 'pending') {
          setQuick('pending');
          return;
        }
        setQuick(key);
        if (tabMode === 'board') setExpandedNodes(prev => ({ ...prev, [key]: true }));
        else setExpandedDecMap(prev => ({ ...prev, [key]: true }));
        requestAnimationFrame(() => {
          const el = rootRef.current && rootRef.current.querySelector(`.kgb-node[data-node="${key}"]`);
          if (el) el.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
        });
      };

      const toggleNode = (id) => {
        if (q) setQuery('');
        setQuick(null);
        if (tabMode === 'board') setExpandedNodes(prev => ({ ...prev, [id]: !prev[id] }));
        else setExpandedDecMap(prev => ({ ...prev, [id]: !prev[id] }));
      };

      function field(k, v, mono) {
        return h('div', { className: 'kgb-field' },
          h('div', { className: 'k' }, k),
          h('div', { className: 'v' + (mono ? ' mono' : '') }, v)
        );
      }

      const renderItem = (it, nodeId) => h('div', {
        key: 'it-' + it.line,
        className: cls('kgb-item', it.done && 'done'),
        onClick: () => toggleItem(it.line, !it.done, nodeId, it.text, it.id)
      },
        h('span', { className: 'kgb-box' }, h(IconCheck)),
        h('span', { className: 'kgb-txt' }, it.text,
          (it.pending || it.link) ? h('span', { className: 'kgb-meta' },
            it.pending ? h('span', { className: 'kgb-tag pending' }, '待拍板') : null,
            it.link ? h('span', {
              className: 'kgb-tag link',
              onClick: (e) => { e.stopPropagation(); openDecision(it.link); }
            }, it.link) : null
          ) : null
        )
      );

      const renderNode = (n) => {
        const open = isOpen(n);
        const showDone = Boolean(q) || (!hideDone && doneOpen[n.id]);
        return h('section', { key: 'node-' + n.id, className: cls('kgb-node', open && 'open'), 'data-node': n.id },
          h('button', { className: 'kgb-head', onClick: () => toggleNode(n.id) },
            h(IconChevron, { className: 'kgb-chev' }),
            h('span', { className: 'kgb-num' }, n.id),
            h('span', { className: 'kgb-name' }, n.name),
            h('span', { className: 'kgb-count' }, `${n.done}/${n.total}`),
            h('span', { className: 'kgb-dot', style: { background: dotColor(n) } })
          ),
          h('div', { className: 'kgb-body' },
            h('div', { className: 'kgb-inner' },
              open ? [
                n.scope ? h('div', { key: 'scope', className: 'kgb-scope' }, n.scope) : null,
                ...n._open.map(it => renderItem(it, n.id)),
                showDone ? n._done.map(it => renderItem(it, n.id)) : null,
                (!showDone && !hideDone && n._done.length > 0) ? h('div', { key: 'done-row', className: 'kgb-done-row' },
                  h('button', {
                    className: 'kgb-done-btn',
                    onClick: (e) => { e.stopPropagation(); setDoneOpen(prev => ({ ...prev, [n.id]: !prev[n.id] })); }
                  }, `已完成 ${n._done.length} 项`)
                ) : null,
                (n._open.length === 0 && n._done.length === 0) ? h('div', { key: 'empty', className: 'kgb-empty' }, '暂无条目') : null
              ] : null
            )
          )
        );
      };

      const renderDecision = (d) => h('div', {
        key: 'dec-' + d.id,
        className: 'kgb-dec',
        onClick: () => openDecision(d.id)
      },
        h('div', { className: 'kgb-dec-top' },
          h('span', { className: 'kgb-dec-id' }, d.id),
          h('span', { className: 'kgb-tag ' + statusCls(d) }, d.status || '生效')
        ),
        h('div', { className: 'kgb-dec-title' }, d.title),
        h('div', { className: 'kgb-dec-meta' }, [d.date, d.reversible].filter(Boolean).join(' · '))
      );

      const renderGroup = (g) => {
        const open = isDecOpen(g);
        const hasPending = g.items.some(d => d.status === '待拍板');
        return h('section', { key: 'dgroup-' + g.id, className: cls('kgb-node', open && 'open'), 'data-node': g.id },
          h('button', { className: 'kgb-head', onClick: () => toggleNode(g.id) },
            h(IconChevron, { className: 'kgb-chev' }),
            h('span', { className: 'kgb-num' }, g.id),
            h('span', { className: 'kgb-name' }, g.name),
            h('span', { className: 'kgb-count' }, String(g._items.length)),
            h('span', { className: 'kgb-dot', style: { background: hasPending ? '#ff9500' : '#0a84ff' } })
          ),
          h('div', { className: 'kgb-body' },
            h('div', { className: 'kgb-inner' },
              open ? g._items.map(d => renderDecision(d)) : null
            )
          )
        );
      };

      const renderDrawer = () => {
        const d = drawer;
        return [
          h('div', {
            key: 'backdrop',
            className: cls('kgb-backdrop', d && 'show'),
            onClick: () => setDrawer(null)
          }),
          h('div', { key: 'drawer', className: cls('kgb-drawer', d && 'show') },
            h('div', { className: 'kgb-grip' }),
            d ? h('div', { className: 'kgb-dhead' },
              h('div', { style: { flex: 1, minWidth: 0 } },
                h('div', { style: { display: 'flex', alignItems: 'center', gap: 6 } },
                  h('span', { className: 'kgb-dec-id' }, d.id),
                  h('span', { className: 'kgb-tag ' + statusCls(d) }, d.status || '生效')
                ),
                h('div', { style: { fontSize: 13, fontWeight: 650, marginTop: 3, lineHeight: 1.35 } }, d.title)
              ),
              h('button', { className: 'kgb-close', onClick: () => setDrawer(null) }, h(IconClose))
            ) : null,
            d ? h('div', { className: 'kgb-dbody' },
              field('节点', h('span', {
                className: 'kgb-nchip',
                onClick: () => jumpToNode(d.node.id)
              }, `${d.node.id} ${d.node.name}`)),
              field('日期 · 可逆性', `${d.date || '—'} · ${d.reversible || '—'}`, true),
              d.reason ? field('理由', d.reason) : null,
              d.alternatives ? field('备选', d.alternatives) : null,
              d.impact ? field('影响', h('span', { className: 'kgb-nchips' },
                d.impact.split(/[,，\s]+/).filter(x => x && x !== '—').map((id, i) => h('span', {
                  key: 'imp-' + i,
                  className: 'kgb-nchip',
                  onClick: () => jumpToNode(id.slice(0, 2))
                }, id))
              )) : null,
              d.review ? field('复审', d.review) : null,
              d.partial ? field('部分取代', d.partial) : null,
              d.successor ? field('取代者', d.successor) : null,
              field('来源', `决策台账 · ${d.node.id} ${d.node.name}`, true)
            ) : null
          )
        ];
      };

      const progressPct = tabMode === 'board'
        ? stats.percent
        : (decData.total ? Math.round(((decData.total - decData.pending) / decData.total) * 100) : 0);

      const activeDisplay = payload?.display_name || payload?.project || project;

      return h('div', { className: 'kgb-root', ref: rootRef },
        h('style', null, CSS),

        h('div', { className: 'kgb-top' },
          h('select', {
            className: 'kgb-select',
            value: project,
            onChange: (e) => onSelectProject(e.target.value)
          },
            projects.length === 0
              ? h('option', { value: project }, activeDisplay || '加载中…')
              : projects.map(p => h('option', { key: p.name, value: p.name },
                  `${p.display_name || p.name}${p.has_board ? ` (${p.stats?.percent ?? 0}%)` : ''}`
                ))
          ),
          h('button', { className: 'kgb-icon', onClick: onRefreshCurrent, title: '刷新当前数据' },
            h(IconRefresh, { spinning: loading || decLoading })
          )
        ),

        h('div', { className: 'kgb-info' },
          h('div', { className: 'kgb-info-row' },
            h('b', null, tabMode === 'board' ? `${activeDisplay} 进度看板` : `${activeDisplay} 决策台账`),
            h('span', null, tabMode === 'board'
              ? `${stats.done}/${stats.total} · ${stats.percent}%`
              : `${decData.total} 条 · 待拍板 ${decData.pending}`)
          ),
          h('div', { className: 'kgb-bar' }, h('div', { className: 'kgb-fill', style: { width: progressPct + '%' } }))
        ),

        h('div', { className: 'kgb-tabs' },
          h('button', {
            className: cls('kgb-tab', tabMode === 'board' && 'on'),
            onClick: () => { setTabMode('board'); setQuick(null); }
          }, '任务', h('span', { className: 'n' }, String(stats.open))),
          h('button', {
            className: cls('kgb-tab', tabMode === 'decisions' && 'on'),
            onClick: () => { setTabMode('decisions'); setQuick(null); fetchDecisions(project); }
          }, '决策', h('span', { className: 'n' }, String(decData.total)))
        ),

        h('div', { className: 'kgb-search' },
          h('div', { className: 'kgb-si' },
            h(IconSearch),
            h('input', {
              value: query,
              placeholder: tabMode === 'board' ? '搜索任务、编号…' : '搜索决策、编号、理由…',
              onChange: (e) => setQuery(e.target.value)
            })
          )
        ),

        ((tabMode === 'board' && hasBoard) || (tabMode === 'decisions' && hasDecisions))
          ? h('div', { className: 'kgb-chips' },
              chips.map(c => h('button', {
                key: c.key,
                className: cls('kgb-chip', (c.key === 'all' ? !quick : quick === c.key) && 'on', c.pending && 'pending'),
                onClick: () => onChip(c.key)
              }, c.label, h('span', { className: 'n' }, String(c.n))))
            )
          : null,

        h('div', { className: 'kgb-list' },
          error ? h('div', { className: 'kgb-empty' }, error) :
          tabMode === 'board'
            ? (!hasBoard
                ? h('div', { className: 'kgb-empty' }, loading ? '加载中…' : '该项目暂无进度看板')
                : (shownNodes.length ? shownNodes.map(renderNode) : h('div', { className: 'kgb-empty' }, '没有匹配的任务')))
            : (!hasDecisions
                ? h('div', { className: 'kgb-empty' }, decLoading ? '加载中…' : '该项目暂无决策台账')
                : (shownGroups.length ? shownGroups.map(renderGroup) : h('div', { className: 'kgb-empty' }, '没有匹配的决策')))
        ),

        h('div', { className: 'kgb-foot' },
          tabMode === 'board'
            ? h(React.Fragment, null,
                h('button', { className: 'kgb-switch', onClick: () => setHideDone(v => !v) },
                  h('span', { className: cls('kgb-mini', hideDone && 'on') }), '仅未完成'
                ),
                h('button', {
                  type: 'button',
                  className: 'kgb-expand-btn',
                  onClick: toggleExpandAllNodes,
                  title: allNodesOpen ? '一键全部收起' : '一键全部展开'
                }, allNodesOpen ? '⊟ 收起全部' : '⊞ 展开全部'),
                h('span', { className: 'kgb-spacer' }),
                h('span', { className: 'kgb-dim' }, `未完成 ${stats.open} · 待拍板 ${pendingTasks}`)
              )
            : h(React.Fragment, null,
                h('div', { className: 'kgb-pills' },
                  [['all', '全部'], ['active', '生效'], ['pending', '待拍板'], ['superseded', '已取代']].map(([k, l]) =>
                    h('button', {
                      key: k,
                      className: cls('kgb-pill', decStatus === k && 'on'),
                      onClick: () => setDecStatus(k)
                    }, l)
                  )
                ),
                h('button', {
                  type: 'button',
                  className: 'kgb-expand-btn',
                  onClick: toggleExpandAllDecs,
                  title: allDecsOpen ? '一键全部收起' : '一键全部展开'
                }, allDecsOpen ? '⊟ 收起全部' : '⊞ 展开全部'),
                h('span', { className: 'kgb-spacer' }),
                h('span', { className: 'kgb-dim' }, String(decData.total))
              )
        ),

        renderDrawer()
      );
    }

    // ── plugin lifecycle ─────────────────────────────────────────────────────
    function apply(ctx) {
      ctx.effect(() => {
        return ctx.sidebarRightTabs?.register({
          id: TAB_ID,
          kind: TAB_KIND,
          priority: 'extension',
          patterns: [],
          canOpen: () => true,
          title: () => '项目看板',
          guide: [
            {
              order: 45,
              title: () => '项目看板',
              description: () => '查看项目结构、待办、决策台账与进度',
              icon: IconKanban
            }
          ]
        });
      }, 'dsh-project-board: sidebar right type');

      ctx.effect(() => ctx.slots.inject('sidebar.right.pane.tab', () => {
        const d1 = ctx.slots.register({ name: 'sidebar.right.pane.tab', key: TAB_ID }, NativeBoardTab);
        const d2 = ctx.slots.register({ name: 'sidebar.right.pane.tab', key: TAB_KIND }, NativeBoardTab);
        return () => {
          try { d1(); } catch (e) {}
          try { d2(); } catch (e) {}
        };
      }), 'dsh-project-board: sidebar right body');
    }

    const exports = {};
    exports.name = 'dsh-project-board';
    exports.inject = ['slots', 'sidebarRightTabs'];
    exports.apply = apply;
    return exports;
  },
});
