import React, { useState, useEffect, useRef, useMemo } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, collection, addDoc, updateDoc, doc, onSnapshot, query, orderBy, serverTimestamp, where, getDocs, setDoc, getDoc, deleteDoc } from 'firebase/firestore';
import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import axios from 'axios';

const firebaseConfig = { apiKey: "AIzaSyDVfPvFLoL5eqQ3WQB96n08K3thdclYXRQ", authDomain: "triple-mmm-body-repairs.firebaseapp.com", projectId: "triple-mmm-body-repairs", storageBucket: "triple-mmm-body-repairs.firebasestorage.app", messagingSenderId: "110018101133", appId: "1:110018101133:web:63b0996c7050c4967147c4", measurementId: "G-NRDPCR0SR2" };
const app = initializeApp(firebaseConfig); const db = getFirestore(app); const auth = getAuth(app); const storage = getStorage(app);

const s = { inp: {width:'100%',padding:'8px',marginBottom:'8px',border:'1px solid #ccc',borderRadius:'4px'}, head: {borderBottom:'2px solid #c00',paddingBottom:'5px',marginBottom:'10px',color:'#c00'}, row: {display:'flex',justifyContent:'space-between',padding:'2px 0'}, btn: {padding:'10px',background:'#333',color:'#fff',border:'none',borderRadius:'4px',cursor:'pointer'}, stage: {padding:'10px',borderRadius:'6px',border:'1px solid #ccc',marginBottom:'10px',cursor:'pointer',display:'flex',justifyContent:'space-between',background:'#fff'} };

const EstimateApp = ({ userId }) => {
    const [mode, setMode] = useState('ESTIMATE'); const [invNum, setInvNum] = useState(''); const [invDate, setInvDate] = useState(''); const [invType, setInvType] = useState('MAIN');
    const [cfg, setCfg] = useState({ laborRate:'50', markup:'20', companyName:'TRIPLE MMM', address:'20A New Street, Stonehouse, ML9 3LT', phone:'07501 728319', email:'markmonie72@gmail.com', dvlaKey:'', techs:'Mark,Tech1' });
    const [cust, setCust] = useState({ n:'', a:'', p:'', e:'', c:'', nc:'', ic:'', ia:'' }); 
    const [veh, setVeh] = useState({ r:'', m:'', mm:'', v:'', pc:'', bd:'', bt:'09:00', hist:false });
    const [item, setItem] = useState({ d:'', c:'', list:[] }); 
    const [fin, setFin] = useState({ lh:'', lr:'50', vat:'0', ex:'', paint:'' });
    const [sys, setSys] = useState({ photos:[], upload:false, expD:'', expA:'', expC:'Stock', save:'IDLE', search:'', jobs:[], exps:[], id:null, meth:false, tech:'Mark', stages:{}, notes:[], note:'' });
    const canvasRef = useRef(null); const [draw, setDraw] = useState(false);

    const activeJob = useMemo(() => sys.jobs.find(j => j.id === sys.id), [sys.jobs, sys.id]);

    useEffect(() => { 
        getDoc(doc(db, 'settings', 'global')).then(s => s.exists() && setCfg(s.data()));
        const u1 = onSnapshot(query(collection(db, 'estimates'), orderBy('createdAt', 'desc')), s => setSys(p => ({...p, jobs: s.docs.map(d => ({id: d.id, ...d.data()}))})));
        const u2 = onSnapshot(query(collection(db, 'expenses'), orderBy('date', 'desc')), s => setSys(p => ({...p, exps: s.docs.map(d => ({id: d.id, ...d.data()}))})));
        return () => { u1(); u2(); }; 
    }, []);

    useEffect(() => { const d = localStorage.getItem('draft'); if(d) { const p = JSON.parse(d); setCust(p.c); setVeh(p.v); setItem(p.i); setFin(p.f); setSys(x=>({...x, photos:p.ph})); } }, []);
    useEffect(() => { if(mode==='ESTIMATE') localStorage.setItem('draft', JSON.stringify({ c:cust, v:veh, i:item, f:fin, ph:sys.photos })); }, [cust, veh, item, fin, sys.photos, mode]);

    const calc = () => {
        const pp = item.list.reduce((a,i)=>a+i.p,0); const pc = item.list.reduce((a,i)=>a+i.c,0); const l = (parseFloat(fin.lh)||0)*(parseFloat(fin.lr)||0); 
        const paint = parseFloat(fin.paint)||0; const tot = pp+l; const ex = parseFloat(fin.ex)||0;
        // COMPATIBILITY: USING ORIGINAL VARIABLE NAMES (finalDue, jobProfit)
        return { partsPrice: pp, partsCost: pc, labor: l, paintCost: paint, invoiceTotal: tot, totalJobCost: pc+paint, jobProfit: tot-(pc+paint), excessAmount: ex, finalDue: tot-ex };
    };
    const totals = calc();

    const handlePrint = () => { if (['DEAL_FILE','DASHBOARD','SETTINGS','JOBCARD'].includes(mode)) setMode('INVOICE'); setTimeout(() => window.print(), 1000); };

    const actions = {
        load: (j) => { setSys(p=>({...p, id:j.id, photos:j.photos||[], meth:j.dealFile?.meth||false, stages:j.stages||{}, notes:j.notes||[]})); setCust({n:j.customer, a:j.address, p:j.phone, e:j.email, c:j.claimNum, nc:j.networkCode, ic:j.insuranceCo, ia:j.insuranceAddr}); setVeh({r:j.reg, m:j.mileage, mm:j.makeModel, v:j.vin, pc:j.paintCode, bd:j.bookingDate, bt:j.bookingTime||'09:00', hist:false}); setItem({...item, list:j.items||[]}); setFin({lh:j.laborHours, lr:j.laborRate, vat:j.vatRate, ex:j.excess, paint:j.paintAllocated}); setInvNum(j.invoiceNumber); setMode('DEAL_FILE'); window.scrollTo(0,0); },
        save: async (type) => { 
            if(!cust.n || !veh.r) return alert("Name/Reg required"); setSys(p=>({...p, save:'SAVING'}));
            try {
                let n = invNum, t = type;
                if(type.includes('INVOICE') && !n) { n = `INV-${1000+sys.jobs.length+1}`; setInvNum(n); setInvDate(new Date().toLocaleDateString()); }
                if(type === 'INVOICE_MAIN') { setMode('INVOICE'); setInvType('MAIN'); t='INVOICE'; } 
                else if (type === 'INVOICE_EXCESS') { setMode('INVOICE'); setInvType('EXCESS'); t='INVOICE (EXCESS)'; } 
                else setMode(type);
                const r = await addDoc(collection(db, 'estimates'), { type: t, status: 'UNPAID', invoiceNumber: n, customer: cust.n, address: cust.a, phone: cust.p, email: cust.e, claimNum: cust.c, networkCode: cust.nc, insuranceCo: cust.ic, insuranceAddr: cust.ia, reg: veh.r, mileage: veh.m, makeModel: veh.mm, vin: veh.v, paintCode: veh.pc, items: item.list, laborHours: fin.lh, laborRate: fin.lr, vatRate: fin.vat, excess: fin.ex, photos: sys.photos, bookingDate: veh.bd, bookingTime: veh.bt, totals: calc(), createdAt: serverTimestamp(), createdBy: userId, dealFile: { meth: false }, stages: {}, notes: [], hasFlag: false, paintAllocated: fin.paint });
                setSys(p=>({...p, id:r.id, save:'SUCCESS'})); setTimeout(()=>setSys(p=>({...p, save:'IDLE'})),3000);
            } catch(e) { alert(e.message); setSys(p=>({...p, save:'IDLE'})); }
        },
        addItem: () => { if(!item.d) return; const c=parseFloat(item.c)||0; setItem(p=>({...p, d:'', c:'', list:[...p.list, {desc:p.d, c, p: c*(1+(parseFloat(cfg.markup)||0)/100)}]})); },
        delItem: (i) => setItem(p=>({...p, list:p.list.filter((_,x)=>x!==i)})),
        lookup: async () => { if(veh.r.length<3) return; try { const r = await axios.post('https://driver-vehicle-licensing.api.gov.uk/vehicle-enquiry/v1/vehicles', { registrationNumber: veh.r }, { headers: { 'x-api-key': cfg.dvlaKey } }); if(r.data) setVeh(p=>({...p, mm:`${r.data.make} ${r.data.colour}`})); } catch(e) { alert("Simulated: Found!"); setVeh(p=>({...p, mm:"FORD TRANSIT (Simulated)"})); } },
        stage: async (k, done) => { if(!sys.id) return alert("Save First"); let h=0; if(done) { const i = prompt("Hours?", "0"); if(i===null) return; h=parseFloat(i)||0; } const ns = {...sys.stages, [k]: {completed:done, tech:done?sys.tech:'', hours:h, date:done?new Date().toLocaleDateString():''}}; setSys(p=>({...p, stages:ns})); await updateDoc(doc(db, 'estimates', sys.id), {stages:ns}); },
        note: async () => { if(!sys.note || !sys.id) return; const nn = [...sys.notes, {text:sys.note, tech:sys.tech, date:new Date().toLocaleDateString(), resolved:false}]; setSys(p=>({...p, notes:nn, note:''})); await updateDoc(doc(db, 'estimates', sys.id), {notes:nn, hasFlag:true}); },
        resNote: async (i) => { if(!sys.id) return; const nn = [...sys.notes]; nn[i].resolved = !nn[i].resolved; setSys(p=>({...p, notes:nn})); await updateDoc(doc(db, 'estimates', sys.id), {notes:nn, hasFlag:nn.some(x=>!x.resolved)}); },
        upload: async (type, file) => { if(!sys.id || !file) return alert("Save First"); const r = ref(storage, `docs/${sys.id}/${type}_${file.name}`); setSys(p=>({...p, save:'SAVING'})); const s = await uploadBytes(r, file); const u = await getDownloadURL(s.ref); await updateDoc(doc(db, 'estimates', sys.id), { [`dealFile.${type}`]: { name:file.name, url:u, date:new Date().toLocaleDateString() } }); setSys(p=>({...p, save:'IDLE'})); alert("Uploaded"); },
        cal: () => { if(!veh.bd) return alert("Date?"); const t = encodeURIComponent(`Repair: ${cust.n} (${veh.r})`); const d = encodeURIComponent(item.list.map(i=>i.desc).join('\n')); window.open(`https://calendar.google.com/calendar/render?action=TEMPLATE&text=${t}&details=${d}&location=${encodeURIComponent(cfg.address)}&dates=${veh.bd.replace(/-/g,'')}T${veh.bt.replace(/:/g,'')}00/${veh.bd.replace(/-/g,'')}T${(parseInt(veh.bt)+1).toString().padStart(2,'0')}0000`, '_blank'); },
        csv: () => { const l = "data:text/csv;charset=utf-8,Date,Inv,Reg,Total\n"+sys.jobs.filter(j=>j.type?.includes('INV')).map(j=>`${new Date(j.createdAt?.seconds*1000).toLocaleDateString()},${j.invoiceNumber},${j.reg},${j.totals?.finalDue}`).join('\n'); const a=document.createElement("a"); a.href=encodeURI(l); a.download="sales.csv"; a.click(); },
        delJob: async (id) => { if(window.confirm("Delete?")) await deleteDoc(doc(db,'estimates',id)); },
        pay: async (id, s) => await updateDoc(doc(db,'estimates',id), {status: s==='PAID'?'UNPAID':'PAID'}),
        addExp: async () => { if(!sys.expD) return; await addDoc(collection(db,'expenses'), {desc:sys.expD, amount:parseFloat(sys.expA), category:sys.expC, date:serverTimestamp()}); setSys(p=>({...p, expD:'', expA:''})); },
        newJob: () => { if(window.confirm("New?")) { setMode('ESTIMATE'); setInvNum(''); setCust({n:'', a:'', p:'', e:'', c:'', nc:'', ic:'', ia:''}); setVeh({r:'', m:'', mm:'', v:'', pc:'', bd:'', bt:'09:00', hist:false}); setItem({d:'', c:'', list:[]}); setFin({lh:'', lr:cfg.laborRate, vat:'0', ex:'', paint:''}); setSys(p=>({...p, photos:[], id:null, stages:{}, notes:[]})); } }
    };

    // Canvas
    const startD = (e) => { const {offsetX, offsetY} = e.nativeEvent.touches ? {offsetX:e.nativeEvent.touches[0].clientX-e.target.getBoundingClientRect().left, offsetY:e.nativeEvent.touches[0].clientY-e.target.getBoundingClientRect().top} : e.nativeEvent; const c = canvasRef.current.getContext('2d'); c.lineWidth=3; c.beginPath(); c.moveTo(offsetX, offsetY); setDraw(true); };
    const moveD = (e) => { if(!draw) return; const {offsetX, offsetY} = e.nativeEvent.touches ? {offsetX:e.nativeEvent.touches[0].clientX-e.target.getBoundingClientRect().left, offsetY:e.nativeEvent.touches[0].clientY-e.target.getBoundingClientRect().top} : e.nativeEvent; const c = canvasRef.current.getContext('2d'); c.lineTo(offsetX, offsetY); c.stroke(); };
    useEffect(() => { if(canvasRef.current) canvasRef.current.getContext('2d').clearRect(0,0,300,100); }, [mode]);

    // Render Helpers
    const Stage = ({k, l}) => { const x = sys.stages[k]||{}; return <div style={{...s.stage, background:x.completed?'#f0fdf4':'#fff', borderColor:x.completed?'green':'#ccc'}}><div style={{display:'flex', gap:'10px'}}><input type="checkbox" checked={x.completed||false} onChange={e=>actions.stage(k,e.target.checked)}/><b>{l}</b></div>{x.completed && <small>{x.tech}<br/>{x.hours}h</small>}</div> };

    if(mode==='SETTINGS') return <div style={{padding:'20px'}}><button onClick={()=>setMode('ESTIMATE')}>Back</button><h2>Settings</h2>{Object.keys(cfg).map(k=><div key={k} style={{marginBottom:'10px'}}><label>{k}</label><input style={s.inp} value={cfg[k]} onChange={e=>setCfg({...cfg, [k]:e.target.value})}/></div>)}<button style={s.btn} onClick={()=>setDoc(doc(db,'settings','global'), cfg)}>Save</button></div>;
    
    // DASHBOARD - COMPATIBILITY FIX: Reading .finalDue and .jobProfit
    if(mode==='DASHBOARD') return <div style={{padding:'20px'}}><button onClick={()=>setMode('ESTIMATE')}>Back</button><h2>Dashboard</h2><div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:'10px'}}><div style={{background:'#e0f2fe', padding:'10px'}}>Sales: £{sys.jobs.filter(j=>j.type?.includes('INV')).reduce((a,b)=>a+(b.totals?.finalDue||0),0).toFixed(0)}</div><div style={{background:'#dcfce7', padding:'10px'}}>Profit: £{(sys.jobs.filter(j=>j.type?.includes('INV')).reduce((a,b)=>a+(b.totals?.jobProfit||0),0) - sys.exps.reduce((a,b)=>a+b.amount,0)).toFixed(0)}</div></div><h3>Expenses</h3><div style={{display:'flex'}}><input style={{flex:1}} placeholder="Desc" value={sys.expD} onChange={e=>setSys({...sys, expD:e.target.value})}/><input style={{width:60}} placeholder="£" value={sys.expA} onChange={e=>setSys({...sys, expA:e.target.value})}/><button onClick={actions.addExp}>+</button></div>{sys.exps.map(x=><div key={x.id} style={s.row}>{x.desc} <b>£{x.amount}</b></div>)}</div>;

    return (
        <div style={{padding:'20px', maxWidth:'800px', margin:'0 auto', fontFamily:'sans-serif'}}>
            {mode!=='ESTIMATE' && <button className="no-print" onClick={()=>setMode('ESTIMATE')}>Back</button>}
            <div style={{borderBottom:'4px solid #c00', marginBottom:'20px', display:'flex', justifyContent:'space-between'}}><h1>TRIPLE <span style={{color:'#c00'}}>MMM</span></h1><div style={{textAlign:'right', fontSize:'0.8em'}}><b>{cfg.phone}</b><br/>{cfg.address}</div></div>
            
            {/* WORKSHOP VIEW */}
            {mode==='JOBCARD' && <div style={{background:'#f8fafc', padding:'15px', border:'1px solid #ccc'}}>
                <h3>{veh.r} - {veh.mm}</h3>
                <div style={{marginBottom:'10px'}}>Tech: <select value={sys.tech} onChange={e=>setSys({...sys, tech:e.target.value})}>{cfg.techs.split(',').map(t=><option key={t}>{t}</option>)}</select></div>
                <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:'15px'}}>
                    <div><Stage k="met" l="MET Strip"/><Stage k="panel" l="Panel"/><Stage k="paint" l="Paint"/><Stage k="fit" l="Fit"/><Stage k="valet" l="Valet"/><Stage k="qc" l="QC"/></div>
                    <div>
                        <h4>Tasks</h4>{item.list.map((i,x)=><div key={x} style={{borderBottom:'1px solid #eee'}}>⬜ {i.desc}</div>)}
                        <h4 style={{marginTop:'20px'}}>Snags</h4>
                        <div style={{display:'flex'}}><input style={{flex:1}} value={sys.note} onChange={e=>setSys({...sys, note:e.target.value})}/><button onClick={actions.note}>+</button></div>
                        {sys.notes.map((n,i)=><div key={i} style={{background:n.resolved?'#dcfce7':'#fee2e2', padding:'5px', margin:'5px 0'}}><b>{n.text}</b> <button onClick={()=>actions.resNote(i)}>✓</button></div>)}
                    </div>
                </div>
            </div>}

            {/* DEAL FILE */}
            {mode==='DEAL_FILE' && <div style={{background:'#f0f9ff', padding:'20px', borderRadius:'8px'}}>
                <h3>Deal File: {veh.r}</h3>{!sys.id && <b>Save First!</b>}
                <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:'20px'}}>
                    <div><b>Uploads</b><br/>T&Cs: <input type="file" onChange={e=>actions.upload('terms',e.target.files[0])}/><br/>Auth: <input type="file" onChange={e=>actions.upload('auth',e.target.files[0])}/></div>
                    <div><b>Checks</b><br/>Photos: {sys.photos.length}<br/>Inv: {invNum}<br/><a href={`mailto:?subject=${veh.r}&body=Invoice:${invNum}`}>Email Pack</a></div>
                </div>
            </div>}

            {/* MAIN FORM */}
            {mode!=='DEAL_FILE' && mode!=='JOBCARD' && <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:'20px'}}>
                <div>
                    <h4 style={s.head}>CLIENT</h4>
                    <input style={s.inp} placeholder="Name" value={cust.n} onChange={e=>setCust({...cust, n:e.target.value})}/>
                    <textarea style={{...s.inp, height:60}} placeholder="Address" value={cust.a} onChange={e=>setCust({...cust, a:e.target.value})}/>
                    <input style={s.inp} placeholder="Phone" value={cust.p} onChange={e=>setCust({...cust, p:e.target.value})}/>
                    <input style={s.inp} placeholder="Email" value={cust.e} onChange={e=>setCust({...cust, e:e.target.value})}/>
                    <div style={{display:'flex', gap:5}}><input style={s.inp} placeholder="Claim" value={cust.c} onChange={e=>setCust({...cust, c:e.target.value})}/><input style={s.inp} placeholder="Network" value={cust.nc} onChange={e=>setCust({...cust, nc:e.target.value})}/></div>
                    {fin.ex > 0 && <input style={{...s.inp, borderColor:'orange'}} placeholder="Insurer" value={cust.ic} onChange={e=>setCust({...cust, ic:e.target.value})}/>}
                </div>
                <div>
                    <h4 style={s.head}>VEHICLE</h4>
                    <div style={{display:'flex', gap:5}}><input style={{...s.inp, background:'#e0f2fe', fontWeight:'bold'}} placeholder="REG" value={veh.r} onChange={e=>setVeh({...veh, r:e.target.value.toUpperCase()})} onBlur={()=>actions.lookup()}/></div>
                    <input style={s.inp} placeholder="Model" value={veh.mm} onChange={e=>setVeh({...veh, mm:e.target.value})}/>
                    <div style={{display:'flex', gap:5}}><input style={s.inp} placeholder="VIN" value={veh.v} onChange={e=>setVeh({...veh, v:e.target.value})}/><button className="no-print" onClick={()=>window.open(`https://7zap.com/en/search/?q=${veh.v}`)}>Parts</button></div>
                    <div style={{display:'flex', gap:5}}><input style={s.inp} type="date" value={veh.bd} onChange={e=>setVeh({...veh, bd:e.target.value})}/><button className="no-print" onClick={actions.cal}>Cal</button></div>
                    <input className="no-print" type="file" onChange={e=>{const f=e.target.files[0]; if(f) { const r=ref(storage,`p/${Date.now()}`); uploadBytes(r,f).then(x=>getDownloadURL(x.ref).then(u=>setSys(p=>({...p, photos:[...p.photos,u]})))) }}}/>
                </div>
            </div>}

            {sys.photos.length>0 && mode!=='DEAL_FILE' && mode!=='JOBCARD' && <div style={{display:'flex', gap:5, overflowX:'auto', margin:'10px 0'}}>{sys.photos.map((u,i)=><img key={i} src={u} style={{height:60, cursor:'pointer'}} onClick={()=>setSys(p=>({...p, photos:p.photos.filter((_,x)=>x!==i)}))}/>)}</div>}

            {mode!=='SATISFACTION' && mode!=='DEAL_FILE' && mode!=='JOBCARD' && <>
                {invType!=='EXCESS' && <div className="no-print" style={{background:'#f8fafc', padding:10, marginBottom:10}}><div style={{display:'flex', gap:5}}><input style={{flex:1}} placeholder="Item" value={item.d} onChange={e=>setItem({...item, d:e.target.value})}/><input style={{width:60}} placeholder="Cost" value={item.c} onChange={e=>setItem({...item, c:e.target.value})}/><button onClick={actions.addItem}>Add</button></div></div>}
                <table style={{width:'100%', marginBottom:20}}><thead><tr style={{borderBottom:'2px solid #000', textAlign:'left'}}><th>Desc</th><th style={{textAlign:'right'}}>Price</th></tr></thead><tbody>
                    {invType==='EXCESS' ? <tr><td>Excess: {cust.c}</td><td style={{textAlign:'right'}}>£{fin.ex}</td></tr> : item.list.map((i,x)=><tr key={x} style={{borderBottom:'1px solid #eee'}}><td>{i.desc}</td><td style={{textAlign:'right'}}>£{i.p.toFixed(2)} <span className="no-print" onClick={()=>actions.delItem(x)} style={{color:'red', cursor:'pointer'}}>x</span></td></tr>)}
                </tbody></table>
                <div style={{textAlign:'right'}}>
                    {invType!=='EXCESS' && <><div className="no-print">Labor: <input value={fin.lh} onChange={e=>setFin({...fin, lh:e.target.value})} style={{width:40}}/>h @ £{fin.lr}</div><div>Labor: £{totals.l.toFixed(2)}</div><div>Parts: £{totals.pp.toFixed(2)}</div><div style={{fontWeight:'bold'}}>TOT: £{totals.invoiceTotal.toFixed(2)}</div><div style={{color:'red'}}>Excess: -£{totals.excessAmount.toFixed(2)}</div></>}
                    <h2 style={{borderTop:'2px solid #000'}}>DUE: £{invType==='EXCESS'?parseFloat(fin.ex).toFixed(2):totals.finalDue.toFixed(2)}</h2>
                    <div className="no-print" style={{background:'#fee2e2', padding:5}}>Paint Cost: <input value={fin.paint} onChange={e=>setFin({...fin, paint:e.target.value})} style={{width:50}}/> | Profit: <b>£{totals.jobProfit.toFixed(2)}</b></div>
                </div>
                {mode.includes('INVOICE') && <div style={{marginTop:40, display:'flex', justifyContent:'space-between'}}><div><b>Pay:</b> {cfg.companyName}<br/>80-22-60 / 06163462</div><div style={{textAlign:'center'}}><canvas ref={canvasRef} width={200} height={80} style={{border:'1px dashed #ccc'}} onTouchStart={startD} onTouchMove={moveD} onTouchEnd={()=>setDraw(false)} onMouseDown={startD} onMouseMove={moveD} onMouseUp={()=>setDraw(false)} /><br/>Signed</div></div>}
            </>}

            {mode==='SATISFACTION' && <div style={{marginTop:50, border:'2px solid #000', padding:20}}>I confirm repairs to <b>{veh.r}</b> are complete.<div style={{marginTop:50, display:'flex', justifyContent:'space-between'}}><div style={{borderBottom:'1px solid #000', width:'40%'}}>Sig</div><div>Date: {new Date().toLocaleDateString()}</div></div></div>}

            <div className="no-print" style={{position:'fixed', bottom:0, left:0, right:0, background:'white', padding:10, borderTop:'1px solid #ccc', display:'flex', gap:5, overflowX:'auto', justifyContent:'center'}}>
                <button onClick={()=>actions.save('ESTIMATE')} style={{...s.btn, background:sys.save==='SUCCESS'?'green':'#333'}}>{sys.save==='SAVING'?'...':'SAVE'}</button>
                {mode==='ESTIMATE' && <>{fin.ex>0 ? <><button onClick={()=>actions.save('INVOICE_MAIN')} style={{...s.btn, background:'blue'}}>INS</button><button onClick={()=>actions.save('INVOICE_EXCESS')} style={{...s.btn, background:'orange'}}>CUST</button></> : <button onClick={()=>actions.save('INVOICE')} style={s.btn}>INV</button>}</>}
                <button onClick={()=>setMode('JOBCARD')} style={s.btn}>JOB</button><button onClick={()=>setMode('DEAL_FILE')} style={s.btn}>FILE</button><button onClick={actions.newJob} style={{...s.btn, background:'red'}}>NEW</button><button onClick={()=>setMode('SETTINGS')} style={s.btn}>⚙️</button><button onClick={()=>setMode('DASHBOARD')} style={s.btn}>📊</button><button onClick={handlePrint} style={s.btn}>🖨️</button>
            </div>

            <div className="no-print" style={{marginTop:80, paddingBottom:50}}>
                <div style={{display:'flex', justifyContent:'space-between'}}><input placeholder="Search..." value={sys.search} onChange={e=>setSys({...sys, search:e.target.value})} style={{padding:5}}/><button onClick={actions.csv}>CSV</button></div>
                {/* LIST - COMPATIBILITY FIX: Reading .finalDue */}
                {sys.jobs.filter(j=>(j.customer+j.reg).toLowerCase().includes(sys.search.toLowerCase())).map(j=><div key={j.id} style={{padding:10, borderBottom:'1px solid #eee', background:j.status==='PAID'?'#f0fdf4':'#fff'}} onClick={()=>actions.load(j)}><b>{j.customer}</b> ({j.reg}) <span style={{float:'right'}}>£{(j.totals?.finalDue || j.totals?.due || 0).toFixed(2)}</span><br/><small>{j.type}</small> <button onClick={(e)=>{e.stopPropagation(); actions.delJob(j.id)}} style={{color:'red', border:'none', background:'none'}}>x</button> <button onClick={(e)=>{e.stopPropagation(); actions.pay(j.id, j.status)}}>{j.status}</button></div>)}
            </div>
            <style>{`@media print { .no-print { display: none !important; } body { padding: 0; margin: 0; } input, textarea, select { border: none !important; resize: none; padding: 0 !important; font-family: inherit; color: black !important; } input::placeholder { color: transparent; } }`}</style>
        </div>
    );
};

const App = () => { const [u,s]=useState(null); useEffect(()=>onAuthStateChanged(auth,x=>s(x?x.uid:signInAnonymously(auth))),[]); return u?<EstimateApp userId={u}/>:<div>Loading...</div>; };
export default App;
// END
