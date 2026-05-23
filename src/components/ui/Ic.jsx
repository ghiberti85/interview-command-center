const Ic = ({ n, s=16, c="currentColor" }) => {
  const P = {
    target:   <><circle cx="12" cy="12" r="10" stroke={c} strokeWidth="1.5" fill="none"/><circle cx="12" cy="12" r="6" stroke={c} strokeWidth="1.5" fill="none"/><circle cx="12" cy="12" r="2" fill={c}/></>,
    pipeline: <><rect x="3" y="3" width="6" height="18" rx="1.5" stroke={c} strokeWidth="1.5" fill="none"/><rect x="12" y="7" width="9" height="14" rx="1.5" stroke={c} strokeWidth="1.5" fill="none"/></>,
    chart:    <><path d="M3 3v18h18" stroke={c} strokeWidth="1.5" strokeLinecap="round"/><path d="M7 16l4-6 4 3 4-8" stroke={c} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></>,
    archive:  <><rect x="2" y="4" width="20" height="4" rx="1" stroke={c} strokeWidth="1.5" fill="none"/><path d="M4 8v11a1 1 0 001 1h14a1 1 0 001-1V8" stroke={c} strokeWidth="1.5"/><path d="M10 13h4" stroke={c} strokeWidth="1.5" strokeLinecap="round"/></>,
    plus:     <><path d="M12 5v14M5 12h14" stroke={c} strokeWidth="1.5" strokeLinecap="round"/></>,
    search:   <><circle cx="11" cy="11" r="8" stroke={c} strokeWidth="1.5" fill="none"/><path d="M21 21l-4.35-4.35" stroke={c} strokeWidth="1.5" strokeLinecap="round"/></>,
    back:     <><path d="M19 12H5M12 5l-7 7 7 7" stroke={c} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></>,
    star:     <><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" stroke={c} strokeWidth="1.5" fill="none" strokeLinejoin="round"/></>,
    starF:    <><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" stroke={c} strokeWidth="1.5" fill={c} strokeLinejoin="round"/></>,
    edit:     <><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" stroke={c} strokeWidth="1.5" strokeLinecap="round"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" stroke={c} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></>,
    close:    <><path d="M18 6L6 18M6 6l12 12" stroke={c} strokeWidth="1.5" strokeLinecap="round"/></>,
    trash:    <><polyline points="3 6 5 6 21 6" stroke={c} strokeWidth="1.5" strokeLinecap="round"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" stroke={c} strokeWidth="1.5"/><path d="M10 11v6M14 11v6" stroke={c} strokeWidth="1.5" strokeLinecap="round"/><path d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2" stroke={c} strokeWidth="1.5"/></>,
    cal:      <><rect x="3" y="4" width="18" height="18" rx="2" stroke={c} strokeWidth="1.5" fill="none"/><path d="M16 2v4M8 2v4M3 10h18" stroke={c} strokeWidth="1.5" strokeLinecap="round"/></>,
    alert:    <><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" stroke={c} strokeWidth="1.5" fill="none"/><path d="M12 9v4M12 17v.5" stroke={c} strokeWidth="1.5" strokeLinecap="round"/></>,
    copy:     <><rect x="9" y="9" width="13" height="13" rx="2" stroke={c} strokeWidth="1.5" fill="none"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" stroke={c} strokeWidth="1.5" fill="none"/></>,
    check:    <><path d="M20 6L9 17l-5-5" stroke={c} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></>,
    refresh:  <><path d="M4 4v5h5M20 20v-5h-5" stroke={c} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/><path d="M4.93 9A8 8 0 1119 14.07" stroke={c} strokeWidth="1.5" strokeLinecap="round"/></>,
    send:     <><path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" stroke={c} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></>,
    msg:      <><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" stroke={c} strokeWidth="1.5" fill="none"/></>,
    ai:       <><circle cx="12" cy="12" r="3" stroke={c} strokeWidth="1.5" fill="none"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.93 4.93l2.12 2.12M16.95 16.95l2.12 2.12M4.93 19.07l2.12-2.12M16.95 7.05l2.12-2.12" stroke={c} strokeWidth="1.5" strokeLinecap="round"/></>,
    sun:      <><circle cx="12" cy="12" r="5" stroke={c} strokeWidth="1.5" fill="none"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M17.66 6.34l1.41-1.41M4.93 19.07l1.41-1.41" stroke={c} strokeWidth="1.5" strokeLinecap="round"/></>,
    moon:     <><path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z" stroke={c} strokeWidth="1.5" fill="none"/></>,
    linkedin: <><rect x="2" y="2" width="20" height="20" rx="4" stroke={c} strokeWidth="1.5" fill="none"/><path d="M7 10v7M7 7v.5" stroke={c} strokeWidth="1.5" strokeLinecap="round"/><path d="M11 17v-4a2 2 0 014 0v4M11 10v7" stroke={c} strokeWidth="1.5" strokeLinecap="round"/></>,
    email:    <><rect x="3" y="5" width="18" height="14" rx="2" stroke={c} strokeWidth="1.5" fill="none"/><path d="M3 7l9 6 9-6" stroke={c} strokeWidth="1.5" strokeLinecap="round"/></>,
    whatsapp: <><path d="M12 2C6.477 2 2 6.477 2 12c0 1.89.525 3.66 1.438 5.168L2 22l4.832-1.438A9.96 9.96 0 0012 22c5.523 0 10-4.477 10-10S17.523 2 12 2z" stroke={c} strokeWidth="1.5" fill="none"/><path d="M8.5 8.5s1 2 2 3 3 2 3 2l1.5-1.5s.5-.5 1 0l1.5 1.5s.5.5 0 1L16 16s-1 1-3-1-4-4-5-6l1.5-1.5s.5-.5 0-1L8 7s-.5-.5-.5 0l1 1.5" stroke={c} strokeWidth="1.5" strokeLinecap="round" fill="none"/></>,
    info:     <><circle cx="12" cy="12" r="10" stroke={c} strokeWidth="1.5" fill="none"/><path d="M12 8v.5M12 11v5" stroke={c} strokeWidth="1.5" strokeLinecap="round"/></>,
    logout:   <><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9" stroke={c} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></>,
  };
  return <svg width={s} height={s} viewBox="0 0 24 24" fill="none" style={{flexShrink:0}}>{P[n]||null}</svg>;
};

export default Ic;
