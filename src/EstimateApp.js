import React, { useState, useEffect, useRef, useMemo } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, collection, addDoc, updateDoc, doc, onSnapshot, query, orderBy, serverTimestamp, getDocs, setDoc, getDoc, deleteDoc } from 'firebase/firestore';
import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import { QRCodeSVG } from 'qrcode.react';


// --- CONFIG ---
const firebaseConfig = { apiKey: "AIzaSyDVfPvFLoL5eqQ3WQB96n08K3thdclYXRQ", authDomain: "triple-mmm-body-repairs.firebaseapp.com", projectId: "triple-mmm-body-repairs", storageBucket: "triple-mmm-body-repairs.firebasestorage.app", messagingSenderId: "110018101133", appId: "1:110018101133:web:63b0996c7050c4967147c4", measurementId: "G-NRDPCR0SR2" };
const app = initializeApp(firebaseConfig); const db = getFirestore(app); const auth = getAuth(app); const storage = getStorage(app);

// --- ERROR BOUNDARY ---
class ErrorBoundary extends React.Component {
  constructor(props) { super(props); this.state = { hasError: false }; }
  static getDerivedStateFromError(error) { return { hasError: true }; }
  componentDidCatch(error) { console.error(error); }
  render() { if (this.state.hasError) return <div style={{padding:20}}><h2>System Pause</h2><button onClick={()=>window.location.reload()} style={{padding:15, background:'red', color:'white'}}>Restart App</button></div>; return this.props.children; }
}

// --- STYLES ---
const s = { 
    inp: {width:'100%', padding:'12px', marginBottom:'12px', border:'1px solid #e2e8f0', borderRadius:'10px', fontSize:'16px', boxSizing:'border-box', outline:'none', transition:'border 0.2s', backgroundColor:'#f8fafc'}, 
    head: {borderBottom:'2px solid #cc0000', paddingBottom:'8px', marginBottom:'20px', color:'#1e293b', fontSize:'18px', fontWeight:'700', marginTop:'25px', letterSpacing:'0.5px'}, 
    
    // Buttons
    btn: {padding:'10px 16px', color:'#fff', border:'none', borderRadius:'10px', fontWeight:'600', fontSize:'14px', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', gap:'6px', transition:'transform 0.1s', boxShadow:'0 2px 4px rgba(0,0,0,0.1)'},
    actionBtn: {background:'linear-gradient(135deg, #3b82f6, #2563eb)', color:'white'}, 
    saveBtn: {background:'linear-gradient(135deg, #22c55e, #16a34a)', color:'white'}, 
    dangerBtn: {background:'linear-gradient(135deg, #ef4444, #dc2626)', color:'white'}, 
    secondaryBtn: {background:'#f1f5f9', color:'#334155', border:'1px solid #cbd5e1', boxShadow:'none'}, 
    backBtn: {width:'100%', padding:'15px', background:'#e2e8f0', color:'#1e293b', border:'none', borderRadius:'8px', fontWeight:'bold', marginBottom:'20px', fontSize:'16px', display:'flex', alignItems:'center', justifyContent:'center', gap:'10px', cursor:'pointer'},
    card: {background:'#fff', padding:'20px', border:'1px solid #e2e8f0', borderRadius:'12px', marginBottom:'15px', boxShadow:'0 4px 6px -1px rgba(0, 0, 0, 0.05)'},
    label: {display:'block', fontSize:'11px', color:'#64748b', marginBottom:'4px', fontWeight:'bold', textTransform:'uppercase', letterSpacing:'0.5px'},
    dockItem: {background:'none', border:'none', color:'#64748b', display:'flex', flexDirection:'column', alignItems:'center', fontSize:'10px', gap:'4px', minWidth:'60px', cursor:'pointer', whiteSpace:'nowrap'}
};

const EstimateApp = ({ userId }) => {
    // --- STATE ---
    const [mode, setMode] = useState('ESTIMATE');
    const [cfg, setCfg] = useState({ laborRate:'50', markup:'20', vatRate:'0', companyName:'TRIPLE MMM', address:'20A New Street, Stonehouse, ML9 3LT', phone:'07501 728319', email:'markmonie72@gmail.com', dvlaKey:'LXqv1yDD1IatEPHlntk2w8MEuz9X57lE9TP9sxGc', techs:'Mark,Tech1', logo:'', terms:'' });
    
    // Core Data
    const [cust, setCust] = useState({ n:'', a:'', p:'', e:'', ie:'', c:'', nc:'', ic:'', ia:'' }); 
    const [veh, setVeh] = useState({ r:'', m:'', mm:'', v:'', pc:'', bd:'', bt:'09:00' });
    const [item, setItem] = useState({ d:'', c:'', list:[] }); 
    const [fin, setFin] = useState({ lh:'0', lr:'50', vat:'0', ex:'0', paint:'0' });
    const [sys, setSys] = useState({ photos:[], upload:false, expD:'', expA:'', expC:'Stock', save:'IDLE', search:'', jobs:[], exps:[], id:null, stages:{}, notes:[], note:'', invNum:'', lookupStatus:'IDLE', receiptFile:null, downloading: false });
    
    const canvasRef = useRef(null); const [draw, setDraw] = useState(false);
    const activeJob = useMemo(() => sys.jobs.find(j => j.id === sys.id), [sys.jobs, sys.id]);

    // --- LOADERS ---
    useEffect(() => { 
        getDoc(doc(db, 'settings', 'global')).then(d => d.exists() && setCfg(prev => ({...prev, ...d.data()})));
        const u1 = onSnapshot(query(collection(db, 'estimates'), orderBy('createdAt', 'desc')), s => setSys(p => ({...p, jobs: s.docs.map(d => ({id: d.id, ...d.data()}))})));
        const u2 = onSnapshot(query(collection(db, 'expenses'), orderBy('date', 'desc')), s => setSys(p => ({...p, exps: s.docs.map(d => ({id: d.id, ...d.data()}))})));
        return () => { u1(); u2(); }; 
    }, []);

    // --- SAFETY LOADERS ---
    useEffect(() => { 
        try {
            const d = localStorage.getItem('draft_v24'); 
            if(d) { 
                const p = JSON.parse(d); 
                if(p.c) setCust(p.c); if(p.v) setVeh(p.v); if(p.f) setFin(p.f); 
                if(p.ph) setSys(x=>({...x, photos:p.ph}));
                if(p.i) setItem({ ...p.i, list: Array.isArray(p.i.list) ? p.i.list : [] });
            }
        } catch(e) { localStorage.removeItem('draft_v24'); }
    }, []);

    useEffect(() => { if(mode==='ESTIMATE') localStorage.setItem('draft_v24', JSON.stringify({ c:cust, v:veh, i:item, f:fin, ph:sys.photos })); }, [cust, veh, item, fin, sys.photos, mode]);

    const calc = () => {
        try {
            const list = Array.isArray(item.list) ? item.list : [];
            const pp = list.reduce((a,i)=>a+(parseFloat(i.p)||0),0); 
            const l = (parseFloat(fin.lh)||0)*(parseFloat(fin.lr)||0); 
            const paint = parseFloat(fin.paint)||0; 
            const sub = pp + l + paint;
            const vat = sub * (parseFloat(cfg.vatRate||0)/100);
            const tot = sub + vat; 
            const ex = parseFloat(fin.ex)||0;
            return { partsPrice: pp, labor: l, paintCost: paint, vat: vat, invoiceTotal: tot, finalDue: tot-ex };
        } catch (err) { return { partsPrice:0, finalDue:0, invoiceTotal:0 }; }
    };
    const totals = calc();

    const handlePrint = () => { if(['DEAL_FILE','DASHBOARD','SETTINGS','JOBCARD'].includes(mode)) setMode('INVOICE'); setTimeout(() => window.print(), 1000); };
    
    const actions = {
        load: (j) => { 
            setSys(p=>({...p, id:j.id, photos:j.photos||[], stages:j.stages||{}, notes:j.notes||[], invNum:j.invoiceNumber||''})); 
            setCust({n:j.customer||'', a:j.address||'', p:j.phone||'', e:j.email||'', ie:j.insEmail||'', c:j.claimNum||'', nc:j.networkCode||'', ic:j.insuranceCo||'', ia:j.insuranceAddr||''}); 
            setVeh({r:j.reg||'', m:j.mileage||'', mm:j.makeModel||'', v:j.vin||'', pc:j.paintCode||'', bd:j.bookingDate||'', bt:j.bookingTime||'09:00'}); 
            setItem({...item, list: Array.isArray(j.items) ? j.items : [] }); 
            setFin({lh:j.laborHours||'', lr:j.laborRate||cfg.laborRate, vat:j.vatRate||'0', ex:j.excess||'', paint:j.paintAllocated||''}); 
            setMode('DEAL_FILE'); window.scrollTo(0,0); 
        },
        save: async (type) => { 
            if(!cust.n || !veh.r) return alert("Name/Reg required"); setSys(p=>({...p, save:'SAVING'}));
            try {
                let n = sys.invNum, t = type;
                let currentNotes = [...sys.notes];
                if(type.includes('INVOICE') && !n) { n = `INV-${1000+sys.jobs.length+1}`; setSys(p=>({...p, invNum:n})); }
                
                if(type === 'INVOICE_MAIN') { setMode('INVOICE'); t='INVOICE'; } 
                else if (type === 'INVOICE_EXCESS') { 
                    setMode('INVOICE'); t='INVOICE (EXCESS)'; 
                    currentNotes.push({text: `Excess Invoice ${n} Generated`, date: new Date().toLocaleDateString(), resolved: true});
                    setSys(p=>({...p, notes: currentNotes}));
                } 
                else setMode(type);
                
                const data = { type: t, status: 'UNPAID', invoiceNumber: n, customer: cust.n, address: cust.a, phone: cust.p, email: cust.e, insEmail: cust.ie, claimNum: cust.c, networkCode: cust.nc, insuranceCo: cust.ic, insuranceAddr: cust.ia, reg: veh.r, mileage: veh.m, makeModel: veh.mm, vin: veh.v, paintCode: veh.pc, items: item.list, laborHours: fin.lh, laborRate: fin.lr, vatRate: fin.vat, excess: fin.ex, photos: sys.photos, bookingDate: veh.bd, bookingTime: veh.bt, totals: calc(), createdAt: serverTimestamp(), createdBy: userId, stages: sys.stages, notes: currentNotes, paintAllocated: fin.paint };
                
                if(sys.id) { await updateDoc(doc(db, 'estimates', sys.id), data); setSys(p=>({...p, save:'SUCCESS'})); }
                else { const r = await addDoc(collection(db, 'estimates'), data); setSys(p=>({...p, id:r.id, save:'SUCCESS'})); }
                setTimeout(()=>setSys(p=>({...p, save:'IDLE'})),3000);
            } catch(e) { alert(e.message); setSys(p=>({...p, save:'IDLE'})); }
        },
        addItem: () => { if(!item.d) return; const c=parseFloat(item.c)||0; setItem(p=>({...p, d:'', c:'', list:[...p.list, {desc:p.d, c, p: c*(1+(parseFloat(cfg.markup)||0)/100)}]})); },
        delItem: (i) => setItem(p=>({...p, list:p.list.filter((_,x)=>x!==i)})),
        
                lookup: async () => { 
            if(veh.r.length < 2) return alert("Enter Reg");
            setSys(p=>({...p, lookupStatus:'SEARCHING...'}));
            const cleanReg = veh.r.replace(/\s/g, '');
            try {
                const proxyUrl = "https://corsproxy.io/?";
                const targetUrl = "https://driver-vehicle-licensing.api.gov.uk/vehicle-enquiry/v1/vehicles";
                const response = await fetch(proxyUrl + encodeURIComponent(targetUrl), {
                    method: "POST",
                    headers: { "x-api-key": cfg.dvlaKey, "Content-Type": "application/json" },
                    body: JSON.stringify({ registrationNumber: cleanReg })
                });
                
                if (!response.ok) throw new Error("Check API Key or Reg");
                const data = await response.json();
                
                // --- SAVE ALL DATA ---
                setVeh(p=>({
                    ...p, 
                    mm: `${data.make} ${data.colour}`, 
                    v: data.vin || '',
                    // We now save the full report here:
                    info: {
                        year: data.yearOfManufacture,
                        fuel: data.fuelType,
                        engine: data.engineCapacity,
                        co2: data.co2Emissions,
                        tax: data.taxStatus,
                        mot: data.motStatus
                    }
                })); 
                setSys(p=>({...p, lookupStatus:'FOUND'}));
            } catch(e) { 
                alert("Lookup Error: " + e.message); 
                setSys(p=>({...p, lookupStatus:'FAILED'}));
            }
        },

        
        parts: () => { 
            const cleanVin = (veh.v||'').replace(/\s/g, '');
            if (cleanVin.length > 5) window.open(`https://partsouq.com/en/search/all?q=${cleanVin}`, '_blank'); 
            else if(window.confirm("No VIN found. Search eBay Parts by Reg?")) window.open(`https://www.ebay.co.uk/sch/i.html?_nkw=${veh.r}+parts`, '_blank'); 
        },
        
        paint: () => { 
            if(!veh.mm) return alert("Enter Make/Model first");
            const make = veh.mm.split(' ')[0].toUpperCase();
            let url = `https://paintref.com/cgi-bin/colorcodedisplay.cgi?manuf=${make}`; 
            if(make.includes('FORD')) url = 'https://www.ford.co.uk/support/vehicle-dashboard'; 
            if(make.includes('BMW')) url = 'https://bimmer.work/'; 
            if(make.includes('MERCEDES')) url = 'https://www.lastvin.com/'; 
            if(make.includes('VOLKSWAGEN') || make.includes('VW') || make.includes('AUDI') || make.includes('SEAT') || make.includes('SKODA')) url = 'https://erwin.volkswagen.de/erwin/showHome.do'; 
            if(make.includes('TOYOTA')) url = 'https://www.toyota-tech.eu/'; 
            window.open(url, '_blank'); 
        },
        emailIns: () => { window.location.href = `mailto:${cust.ie}?subject=${encodeURIComponent(`Claim: ${cust.c} - ${veh.r}`)}`; },
        cal: () => { window.open(`https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(`Repair: ${veh.r}`)}&details=${encodeURIComponent(`Job for ${cust.n}. ${veh.mm}`)}&dates=${veh.bd.replace(/-/g,'')}T090000/${veh.bd.replace(/-/g,'')}T100000`, '_blank'); },

        stage: async (k, done) => { if(!sys.id) return alert("Save First"); const ns = {...sys.stages, [k]: {completed:done, date:done?new Date().toLocaleDateString():''}}; setSys(p=>({...p, stages:ns})); await updateDoc(doc(db, 'estimates', sys.id), {stages:ns}); },
        note: async () => { if(!sys.note || !sys.id) return; const nn = [...sys.notes, {text:sys.note, date:new Date().toLocaleDateString(), resolved:false}]; setSys(p=>({...p, notes:nn, note:''})); await updateDoc(doc(db, 'estimates', sys.id), {notes:nn}); },
        toggleNote: async (i) => { if(!sys.id) return; const nn = [...sys.notes]; nn[i].resolved = !nn[i].resolved; setSys(p=>({...p, notes:nn})); await updateDoc(doc(db, 'estimates', sys.id), {notes:nn}); },

        upload: async (type, file) => { if(!sys.id || !file) return alert("Save First"); const r = ref(storage, `docs/${sys.id}/${type}_${file.name}`); setSys(p=>({...p, save:'SAVING'})); await uploadBytes(r, file); const u = await getDownloadURL(r); await updateDoc(doc(db, 'estimates', sys.id), { [`dealFile.${type}`]: { name:file.name, url:u, date:new Date().toLocaleDateString() } }); setSys(p=>({...p, save:'IDLE'})); alert("Uploaded"); },
        
        generateTerms: async () => {
            if(!sys.id) return alert("Save job first");
            if(!cfg.terms) return alert("Please add T&Cs in Settings first.");
            setSys(p=>({...p, save:'SAVING'}));
            const blob = new Blob([cfg.terms], {type: 'text/plain'});
            const fName = `Terms_${Date.now()}.txt`;
            const r = ref(storage, `docs/${sys.id}/terms_${fName}`);
            await uploadBytes(r, blob);
            const u = await getDownloadURL(r);
            await updateDoc(doc(db, 'estimates', sys.id), { [`dealFile.terms`]: { name:fName, url:u, date:new Date().toLocaleDateString() } });
            setSys(p=>({...p, save:'IDLE'}));
        },

        downloadDealPack: async () => {
            if (!activeJob?.dealFile) return alert("No deal file documents found.");
            setSys(p => ({ ...p, downloading: true }));
            try {
                const zip = new JSZip();
                const folder = zip.folder(`Deal_Pack_${veh.r}`);

                const fetchFile = async (url) => {
                    const r = await fetch(url);
                    return r.blob();
                };

                // Add documents
                if (activeJob.dealFile.terms) folder.file("Terms_Conditions.txt", await fetchFile(activeJob.dealFile.terms.url));
                if (activeJob.dealFile.auth) folder.file(`Auth_${activeJob.dealFile.auth.name}`, await fetchFile(activeJob.dealFile.auth.url));
                if (activeJob.dealFile.method) folder.file(`Method_${activeJob.dealFile.method.name}`, await fetchFile(activeJob.dealFile.method.url));
                if (activeJob.dealFile.sat) folder.file(`Satisfaction_${activeJob.dealFile.sat.name}`, await fetchFile(activeJob.dealFile.sat.url));

                // Add photos folder
                if (sys.photos.length > 0) {
                    const imgFolder = folder.folder("Images");
                    await Promise.all(sys.photos.map(async (url, i) => {
                        try {
                            const blob = await fetchFile(url);
                            imgFolder.file(`Photo_${i + 1}.jpg`, blob);
                        } catch (e) { console.error("Photo fail", e); }
                    }));
                }

                const content = await zip.generateAsync({ type: "blob" });
                saveAs(content, `Deal_Pack_${veh.r}.zip`);
                setSys(p => ({ ...p, downloading: false }));
            } catch (e) {
                alert("Error creating zip: " + e.message);
                setSys(p => ({ ...p, downloading: false }));
            }
        },

        uploadPhoto: async (e) => { const f=e.target.files[0]; if(f) { const r = ref(storage, `photos/${Date.now()}_${f.name}`); setSys(p=>({...p, save:'SAVING'})); await uploadBytes(r, f); const u = await getDownloadURL(r); setSys(p=>({...p, save:'IDLE', photos:[...p.photos,u]})); } },
        uploadLogo: async (e) => { const f=e.target.files[0]; if(f) { const r = ref(storage, `settings/logo_${Date.now()}`); await uploadBytes(r, f); const u = await getDownloadURL(r); setCfg(p=>({...p, logo:u})); await setDoc(doc(db,'settings','global'), {...cfg, logo:u}); } },
        
        delJob: async (id) => { if(window.confirm("Delete?")) await deleteDoc(doc(db,'estimates',id)); },
        pay: async (id, currentStatus) => { const s = currentStatus === 'PAID' ? 'UNPAID' : 'PAID'; await updateDoc(doc(db,'estimates',id), {status: s}); },

        setReceipt: (e) => { setSys(p=>({...p, receiptFile: e.target.files[0]})); },
        addExp: async () => { 
            if(!sys.expD) return; 
            let receiptUrl = '';
            if(sys.receiptFile) {
                const r = ref(storage, `receipts/${Date.now()}_${sys.receiptFile.name}`);
                await uploadBytes(r, sys.receiptFile);
                receiptUrl = await getDownloadURL(r);
            }
            await addDoc(collection(db,'expenses'), {desc:sys.expD, amount:parseFloat(sys.expA), category:sys.expC, receipt: receiptUrl, date:serverTimestamp()}); 
            setSys(p=>({...p, expD:'', expA:'', receiptFile:null})); 
        },
        delExp: async (id) => { if(window.confirm("Delete?")) await deleteDoc(doc(db,'expenses',id)); },
        
        csvIncome: () => { 
            const l = "data:text/csv;charset=utf-8,Date,Inv,Reg,Total\n"+sys.jobs.filter(j=>j.type?.includes('INV')).map(j=>`${new Date(j.createdAt?.seconds*1000).toLocaleDateString()},${j.invoiceNumber},${j.reg},${j.totals?.finalDue || j.totals?.invoiceTotal || 0}`).join('\n'); 
            const a=document.createElement("a"); a.href=encodeURI(l); a.download="Income.csv"; a.click(); 
        },
        csvExp: () => { const l = "data:text/csv;charset=utf-8,Date,Desc,Category,Amount,ReceiptLink\n"+sys.exps.map(j=>`${new Date(j.date?.seconds*1000).toLocaleDateString()},${j.desc},${j.category},${j.amount},${j.receipt||''}`).join('\n'); const a=document.createElement("a"); a.href=encodeURI(l); a.download="Expenses.csv"; a.click(); },
        
        newJob: () => { if(window.confirm("New?")) { setMode('ESTIMATE'); setSys(p=>({...p, id:null, photos:[], stages:{}, notes:[], invNum:''})); setCust({n:'', a:'', p:'', e:'', c:'', nc:'', ic:'', ia:''}); setVeh({r:'', m:'', mm:'', v:'', pc:'', bd:'', bt:'09:00'}); setItem({d:'', c:'', list:[]}); } }
    };

    const startD = (e) => { const {offsetX, offsetY} = e.nativeEvent.touches ? {offsetX:e.nativeEvent.touches[0].clientX-e.target.getBoundingClientRect().left, offsetY:e.nativeEvent.touches[0].clientY-e.target.getBoundingClientRect().top} : e.nativeEvent; const c = canvasRef.current.getContext('2d'); c.lineWidth=3; c.beginPath(); c.moveTo(offsetX, offsetY); setDraw(true); };
    const moveD = (e) => { if(!draw) return; const {offsetX, offsetY} = e.nativeEvent.touches ? {offsetX:e.nativeEvent.touches[0].clientX-e.target.getBoundingClientRect().left, offsetY:e.nativeEvent.touches[0].clientY-e.target.getBoundingClientRect().top} : e.nativeEvent; const c = canvasRef.current.getContext('2d'); c.lineTo(offsetX, offsetY); c.stroke(); };
    useEffect(() => { if(canvasRef.current) canvasRef.current.getContext('2d').clearRect(0,0,300,100); }, [mode]);

    const Stage = ({k, l}) => { const x = sys.stages[k]||{}; return <div style={{padding:'12px', background:x.completed?'#f0fdf4':'#fff', border:'1px solid #e2e8f0', borderRadius:'10px', marginBottom:'8px', display:'flex', alignItems:'center', gap:'10px', boxShadow:'0 1px 2px rgba(0,0,0,0.05)'}}><input type="checkbox" style={{transform:'scale(1.5)', accentColor:'#16a34a'}} checked={x.completed||false} onChange={e=>actions.stage(k,e.target.checked)}/><b style={{color:x.completed?'#16a34a':'#334155'}}>{l}</b></div> };

    // --- CHECK FOR DEAL PACK COMPLETION ---
    const isDealComplete = activeJob?.dealFile?.terms && activeJob?.dealFile?.auth && activeJob?.dealFile?.method && activeJob?.dealFile?.sat;

    // --- SETTINGS VIEW ---
    if(mode==='SETTINGS') return (
        <div style={{padding:'20px', maxWidth:'600px', margin:'0 auto'}}>
            <button onClick={()=>setMode('ESTIMATE')} style={s.backBtn}>⬅️ BACK TO JOB</button>
            <h2 style={{margin:'0 0 20px 0', color:'#1e293b'}}>Settings</h2>
            
            <div style={s.card}>
                <div style={{marginBottom:15}}>
                    <label style={s.label}>COMPANY LOGO</label>
                    <input type="file" onChange={actions.uploadLogo} style={s.inp}/>
                    {cfg.logo && <div style={{textAlign:'center', marginTop:10}}><img src={cfg.logo} style={{height:80, borderRadius:8, border:'1px solid #eee'}} alt="Logo"/></div>}
                </div>
            </div>

            <div style={s.card}>
                <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:15}}>
                    <div><label style={s.label}>LABOUR RATE (£)</label><input style={s.inp} value={cfg.laborRate} onChange={e=>setCfg({...cfg, laborRate:e.target.value})}/></div>
                    <div><label style={s.label}>VAT RATE (%)</label><input style={s.inp} value={cfg.vatRate} onChange={e=>setCfg({...cfg, vatRate:e.target.value})}/></div>
                </div>
            </div>

            <div style={s.card}>
                <div style={{marginBottom:15}}>
                    <label style={s.label}>COMPANY NAME</label>
                    <input style={s.inp} value={cfg.companyName} onChange={e=>setCfg({...cfg, companyName:e.target.value})}/>
                </div>
                <div style={{marginBottom:15}}>
                    <label style={s.label}>ADDRESS</label>
                    <textarea style={{...s.inp, height:80}} value={cfg.address} onChange={e=>setCfg({...cfg, address:e.target.value})}/>
                </div>
                <div style={{marginBottom:15}}>
                    <label style={s.label}>PHONE</label>
                    <input style={s.inp} value={cfg.phone} onChange={e=>setCfg({...cfg, phone:e.target.value})}/>
                </div>
                <div style={{marginBottom:15}}>
                    <label style={s.label}>TECHS (Comma separated)</label>
                    <input style={s.inp} value={cfg.techs} onChange={e=>setCfg({...cfg, techs:e.target.value})}/>
                </div>
                <div style={{marginBottom:15}}>
                    <label style={s.label}>TERMS & CONDITIONS TEXT</label>
                    <textarea style={{...s.inp, height:120}} value={cfg.terms} onChange={e=>setCfg({...cfg, terms:e.target.value})} placeholder="Paste T&Cs here..."/>
                </div>
                <div style={{marginBottom:15}}>
                    <label style={s.label}>DVLA API KEY</label>
                    <input style={{...s.inp, border:'1px solid #3b82f6', background:'#eff6ff'}} value={cfg.dvlaKey} onChange={e=>setCfg({...cfg, dvlaKey:e.target.value})}/>
                </div>
            </div>
            
            <button style={{...s.btn, ...s.saveBtn, width:'100%', fontSize:'16px', padding:'15px'}} onClick={()=>setDoc(doc(db,'settings','global'), cfg)}>💾 SAVE SETTINGS</button>
        </div>
    );
    
    if(mode==='DASHBOARD') return <div style={{padding:'20px', maxWidth:'600px', margin:'0 auto'}}>
        <button onClick={()=>setMode('ESTIMATE')} style={s.backBtn}>⬅️ BACK TO JOB</button>
        <h2 style={{margin:'0 0 20px 0', color:'#1e293b'}}>Dashboard</h2>
        
        <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:'15px', marginBottom:25}}>
            <div style={{background:'linear-gradient(135deg, #3b82f6, #2563eb)', padding:'20px', borderRadius:'12px', color:'white', boxShadow:'0 4px 6px rgba(37, 99, 235, 0.2)'}}>
                <div style={{fontSize:'12px', opacity:0.8, fontWeight:'bold', marginBottom:5}}>TOTAL SALES</div>
                <div style={{fontSize:'28px', fontWeight:'bold'}}>£{sys.jobs.filter(j=>j.type?.includes('INV')).reduce((a,b)=>a+(b.totals?.finalDue||b.totals?.due||0),0).toFixed(0)}</div>
            </div>
            <div style={{background:'linear-gradient(135deg, #ef4444, #dc2626)', padding:'20px', borderRadius:'12px', color:'white', boxShadow:'0 4px 6px rgba(220, 38, 38, 0.2)'}}>
                <div style={{fontSize:'12px', opacity:0.8, fontWeight:'bold', marginBottom:5}}>TOTAL COSTS</div>
                <div style={{fontSize:'28px', fontWeight:'bold'}}>£{sys.exps.reduce((a,b)=>a+(b.amount||0),0).toFixed(0)}</div>
            </div>
        </div>

        <div style={{display:'flex', gap:10, marginBottom:25}}>
            <button style={{...s.btn, background:'#0f766e', flex:1}} onClick={actions.csvIncome}>📥 Income CSV</button>
            <button style={{...s.btn, background:'#be123c', flex:1}} onClick={actions.csvExp}>📥 Expense CSV</button>
        </div>

        <div style={s.card}>
            <h3 style={{marginTop:0, marginBottom:15, color:'#334155'}}>Add Expense</h3>
            <div style={{display:'flex', gap:10, marginBottom:10}}>
                <input style={{...s.inp, marginBottom:0, flex:2}} placeholder="Description" value={sys.expD} onChange={e=>setSys({...sys, expD:e.target.value})}/>
                <input style={{...s.inp, marginBottom:0, width:90}} placeholder="£" value={sys.expA} onChange={e=>setSys({...sys, expA:e.target.value})}/>
            </div>
            <div style={{display:'flex', gap:10}}>
                <div style={{position:'relative', overflow:'hidden', flex:1}}>
                    <input type="file" onChange={actions.setReceipt} style={{position:'absolute', opacity:0, top:0, left:0, width:'100%', height:'100%', cursor:'pointer'}}/>
                    <button style={{...s.btn, ...s.secondaryBtn, width:'100%'}}>{sys.receiptFile ? '✅ Receipt Attached' : '📷 Snap Receipt'}</button>
                </div>
                <button style={{...s.btn, ...s.actionBtn, width:60}} onClick={actions.addExp}>➕</button>
            </div>
        </div>

        <div style={{marginTop:20}}>
            <h4 style={{color:'#64748b'}}>Recent Expenses</h4>
            {sys.exps.map(x=><div key={x.id} style={{padding:15, borderBottom:'1px solid #f1f5f9', display:'flex', justifyContent:'space-between', alignItems:'center', background:'#fff'}}>
                <div>
                    <div style={{fontWeight:'600', color:'#334155'}}>{x.desc}</div>
                    <div style={{fontSize:'12px', color:'#94a3b8'}}>{new Date(x.date?.seconds*1000).toLocaleDateString()}</div>
                </div>
                <div style={{display:'flex', alignItems:'center', gap:10}}>
                    {x.receipt && <a href={x.receipt} target="_blank" style={{textDecoration:'none', fontSize:'18px'}}>📎</a>}
                    <span style={{fontWeight:'bold'}}>£{x.amount}</span>
                    <button onClick={()=>actions.delExp(x.id)} style={{color:'#ef4444', border:'none', background:'none', cursor:'pointer', padding:5}}>×</button>
                </div>
            </div>)}
        </div>
    </div>;

    if(mode==='DEAL_FILE') return <div style={{padding:'20px', maxWidth:'600px', margin:'0 auto'}}>
        <button onClick={()=>setMode('ESTIMATE')} style={s.backBtn}>⬅️ BACK TO JOB</button>
        <div style={{...s.card, background:'#f0f9ff', borderColor:'#bae6fd'}}>
            <h3 style={{marginTop:0, color:'#0369a1'}}>📁 Deal File: {veh.r}</h3>
            {!sys.id && <div style={{padding:12, background:'#fef2f2', color:'#b91c1c', borderRadius:8, marginBottom:15, fontWeight:'bold', border:'1px solid #fecaca'}}>⚠️ Please SAVE the job first</div>}
            
            <div style={{background:'white', padding:15, borderRadius:10, marginBottom:15}}>
                <div style={{fontSize:'12px', color:'#64748b', fontWeight:'bold', marginBottom:10}}>DOCUMENTS</div>
                
                {/* TERMS SPECIFIC ROW */}
                <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', padding:'8px 0', borderBottom:'1px solid #f1f5f9'}}>
                    <span style={{fontWeight:'500'}}>Terms & Conditions</span>
                    <div style={{display:'flex', alignItems:'center', gap:10}}>
                        {activeJob?.dealFile?.terms ? <span style={{color:'#16a34a'}}>✅</span> : <button onClick={actions.generateTerms} style={{...s.btn, ...s.secondaryBtn, fontSize:'10px', padding:'5px'}}>⚡ Auto Gen</button>}
                    </div>
                </div>

                {['auth','method','sat'].map(k => (
                    <div key={k} style={{display:'flex', justifyContent:'space-between', alignItems:'center', padding:'8px 0', borderBottom:'1px solid #f1f5f9'}}>
                        <span style={{textTransform:'capitalize', fontWeight:'500'}}>{k === 'sat' ? 'Satisfaction Note' : k}</span>
                        <div style={{display:'flex', alignItems:'center', gap:10}}>
                            {activeJob?.dealFile?.[k] && <span style={{color:'#16a34a'}}>✅</span>}
                            <input type="file" onChange={e=>actions.upload(k,e.target.files[0])} style={{width:90, fontSize:'10px'}}/>
                        </div>
                    </div>
                ))}
            </div>

            {isDealComplete && <button onClick={actions.downloadDealPack} style={{...s.btn, background:'linear-gradient(135deg, #7c3aed, #6d28d9)', width:'100%', marginBottom:15, padding:15}}>{sys.downloading ? '⏳ Zipping...' : '📥 DOWNLOAD DEAL PACK (ZIP)'}</button>}

            <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:10}}>
                <a href={`mailto:?subject=${encodeURIComponent(`Repair Info: ${veh.r}`)}&body=${encodeURIComponent(`Please find attached documents for ${veh.r}. Invoice: ${sys.invNum}`)}`} style={{...s.btn, ...s.actionBtn, textDecoration:'none'}}>📧 Client Pack</a>
                {cust.ie && <a href={`mailto:${cust.ie}?subject=${encodeURIComponent(`Claim: ${cust.c} - ${veh.r}`)}&body=${encodeURIComponent(`Please find attached documents for Claim ${cust.c}.`)}`} style={{...s.btn, background:'#6366f1', textDecoration:'none'}}>✉️ Insurer Pack</a>}
            </div>
        </div>
    </div>;

    if(mode==='JOBCARD') return <div style={{padding:'20px', maxWidth:'600px', margin:'0 auto'}}>
        <button onClick={()=>setMode('ESTIMATE')} style={s.backBtn}>⬅️ BACK TO JOB</button>
        <div style={s.card}>
            <h3 style={{marginTop:0, borderBottom:'1px solid #eee', paddingBottom:10}}>{veh.r} <span style={{fontSize:'14px', color:'#64748b', fontWeight:'normal'}}>{veh.mm}</span></h3>
            <h4 style={{color:'#64748b', marginBottom:10}}>STAGES</h4>
            <Stage k="met" l="MET Strip"/><Stage k="panel" l="Panel"/><Stage k="paint" l="Paint"/><Stage k="fit" l="Fit"/><Stage k="valet" l="Valet"/><Stage k="qc" l="QC"/>
            <h4 style={{color:'#64748b', marginTop:25, marginBottom:10}}>SNAG LIST</h4>
            <div style={{display:'flex', gap:10, marginBottom:15}}>
                <input style={{...s.inp, marginBottom:0}} value={sys.note} onChange={e=>setSys({...sys, note:e.target.value})} placeholder="Add snag..."/>
                <button onClick={actions.note} style={{...s.btn, ...s.actionBtn}}>Add</button>
            </div>
            {sys.notes.map((n,i)=><div key={i} style={{padding:12, background:n.resolved?'#f0fdf4':'#fef2f2', borderLeft:n.resolved?'4px solid #22c55e':'4px solid #ef4444', borderRadius:6, marginBottom:8, fontSize:'14px', display:'flex', justifyContent:'space-between', alignItems:'center', boxShadow:'0 1px 2px rgba(0,0,0,0.05)'}}>
                <span style={{color:n.resolved?'#15803d':'#b91c1c', fontWeight:'500'}}>{n.text}</span>
                <button onClick={()=>actions.toggleNote(i)} style={{border:'none', background:'none', fontSize:'18px', cursor:'pointer'}}>{n.resolved?'✅':'⬜'}</button>
            </div>)}
        </div>
    </div>;

    return (
        <div style={{padding:'15px', paddingBottom:'120px', maxWidth:'600px', margin:'0 auto', fontFamily:'-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif', color:'#334155', background:'#f1f5f9', minHeight:'100vh'}}>
            {/* HEADER RESTORED */}
            <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', padding:'15px 0', marginBottom:10, borderBottom:'1px solid #cbd5e1'}}>
                {cfg.logo ? <img src={cfg.logo} style={{height:55, objectFit:'contain'}} alt="Logo"/> : <h1 style={{margin:0, fontSize:'22px', color:'#1e293b'}}>TRIPLE <span style={{color:'#cc0000'}}>MMM</span></h1>}
                <div style={{textAlign:'right', fontSize:'11px', color:'#64748b', lineHeight:'1.4'}}>
                    <div style={{fontWeight:'bold', color:'#334155'}}>{cfg.phone}</div>
                    <div style={{maxWidth:'150px'}}>{cfg.address}</div>
                </div>
            </div>

            {/* MAIN ESTIMATE FORM */}
            {mode==='ESTIMATE' && <div>
                <div style={s.card}>
                    <h4 style={s.head}>👤 CLIENT</h4>
                    <input style={s.inp} placeholder="Full Name" value={cust.n} onChange={e=>setCust({...cust, n:e.target.value})}/>
                    <textarea style={{...s.inp, height:80}} placeholder="Full Address" value={cust.a} onChange={e=>setCust({...cust, a:e.target.value})}/>
                    <div style={{display:'flex', gap:10}}>
                        <input style={s.inp} placeholder="Phone" value={cust.p} onChange={e=>setCust({...cust, p:e.target.value})}/>
                        <input style={s.inp} placeholder="Email" value={cust.e} onChange={e=>setCust({...cust, e:e.target.value})}/>
                    </div>
                    
                    <h4 style={s.head}>🏢 INSURANCE</h4>
                    <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:'10px'}}>
                        <input style={s.inp} placeholder="Claim #" value={cust.c} onChange={e=>setCust({...cust, c:e.target.value})}/>
                        <input style={s.inp} placeholder="Insurer" value={cust.ic} onChange={e=>setCust({...cust, ic:e.target.value})}/>
                    </div>
                    <div style={{display:'flex', gap:'5px'}}>
                        <input style={{...s.inp, marginBottom:0}} placeholder="Insurer Email" value={cust.ie} onChange={e=>setCust({...cust, ie:e.target.value})}/>
                        <button onClick={actions.emailIns} style={{...s.btn, ...s.secondaryBtn}}>✉️</button>
                    </div>
                </div>

                <div style={s.card}>
                    <h4 style={s.head}>🚗 VEHICLE</h4>
                    <div style={{display:'flex', gap:'10px', marginBottom:'15px'}}>
                        <input style={{...s.inp, marginBottom:0, background:'#e0f2fe', fontWeight:'bold', textAlign:'center', fontSize:'22px', border:'2px solid #3b82f6', color:'#1e3a8a'}} placeholder="ENTER REG" value={veh.r} onChange={e=>setVeh({...veh, r:e.target.value.toUpperCase()})}/>
                        <button onClick={actions.lookup} style={{...s.btn, ...s.actionBtn, minWidth:'80px'}}>{sys.lookupStatus==='SEARCHING...'?'...':'🔍 FIND'}</button>
                    </div>
                    <input style={s.inp} placeholder="Make / Model" value={veh.mm} onChange={e=>setVeh({...veh, mm:e.target.value})}/>
                                      {/* --- NEW DATA DISPLAY --- */}
                    {veh.info && (
                        <div style={{marginTop: 5, marginBottom: 15, padding: 10, background: '#eff6ff', borderRadius: 8, border: '1px solid #bfdbfe', fontSize: '12px', color: '#1e3a8a'}}>
                            <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:5}}>
                                <div>📅 <b>Year:</b> {veh.info.year}</div>
                                <div>⛽ <b>Fuel:</b> {veh.info.fuel}</div>
                                <div>⚙️ <b>Engine:</b> {veh.info.engine} cc</div>
                                <div>💨 <b>CO2:</b> {veh.info.co2} g/km</div>
                                <div>🧾 <b>Tax:</b> {veh.info.tax}</div>
                                <div>🔧 <b>MOT:</b> {veh.info.mot}</div>
                            </div>
                        </div>
                    )}
                    {/* ----------------------- */}
  
                    <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:10}}>
                        <div style={{display:'flex', gap:5}}>
                            <input style={{...s.inp, marginBottom:0}} placeholder="VIN" value={veh.v} onChange={e=>setVeh({...veh, v:e.target.value})}/>
                            <button onClick={actions.parts} style={{...s.btn, background:'#f59e0b'}}>🔩</button>
                        </div>
                        <div style={{display:'flex', gap:5}}>
                            <input style={{...s.inp, marginBottom:0}} placeholder="Paint Code" value={veh.pc} onChange={e=>setVeh({...veh, pc:e.target.value})}/>
                            <button onClick={actions.paint} style={{...s.btn, background:'#8b5cf6'}}>🎨</button>
                        </div>
                    </div>
                    
                    <div style={{display:'flex', gap:'10px'}}>
                        <div style={{flex:1}}><label style={s.label}>Booking Date</label><input type="date" style={s.inp} value={veh.bd} onChange={e=>setVeh({...veh, bd:e.target.value})}/></div>
                        <div style={{width:'100px'}}><label style={s.label}>Time</label><input type="time" style={s.inp} value={veh.bt} onChange={e=>setVeh({...veh, bt:e.target.value})}/></div>
                    </div>
                    <button style={{...s.btn, ...s.secondaryBtn, width:'100%', marginTop:10}} onClick={actions.cal}>📅 Add to Calendar</button>
                    
                    <div style={{marginTop:15, padding:15, background:'#f8fafc', borderRadius:10, border:'2px dashed #cbd5e1', textAlign:'center'}}>
                        <div style={{marginBottom:10, fontSize:'12px', color:'#64748b'}}>{sys.photos.length} photos attached</div>
                        <div style={{position:'relative', overflow:'hidden', display:'inline-block'}}>
                            <input type="file" onChange={actions.uploadPhoto} style={{position:'absolute', opacity:0, top:0, left:0, width:'100%', height:'100%', cursor:'pointer'}}/>
                            <button style={{...s.btn, ...s.secondaryBtn}}>📸 Upload Photos</button>
                        </div>
                    </div>
                </div>
            </div>}
            
            {/* PHOTOS STRIP */}
            {sys.photos.length>0 && mode!=='DEAL_FILE' && mode!=='JOBCARD' && <div style={{display:'flex', gap:10, overflowX:'auto', paddingBottom:15, paddingLeft:5}}>{sys.photos.map((u,i)=><img key={i} src={u} style={{height:100, borderRadius:8, border:'1px solid #ddd', boxShadow:'0 2px 4px rgba(0,0,0,0.1)'}}/>)}</div>}

            {/* FINANCIALS */}
            {mode==='ESTIMATE' && <div style={{marginTop:30}}>
                <h4 style={s.head}>🛠️ PARTS & LABOUR</h4>
                <div className="no-print" style={s.card}>
                    <div style={{display:'flex', gap:10}}>
                        <input style={{...s.inp, flex:2, marginBottom:0}} placeholder="Item Description" value={item.d} onChange={e=>setItem({...item, d:e.target.value})}/>
                        <input type="number" style={{...s.inp, flex:1, marginBottom:0}} placeholder="£ Cost" value={item.c} onChange={e=>setItem({...item, c:e.target.value})}/>
                        <button onClick={actions.addItem} style={{...s.btn, ...s.saveBtn}}>ADD</button>
                    </div>
                </div>

                <div style={s.card}>
                    <table style={{width:'100%', borderCollapse:'collapse', marginBottom:'20px'}}>
                        <thead><tr style={{borderBottom:'2px solid #e2e8f0', textAlign:'left', fontSize:'12px', color:'#64748b'}}><th>DESCRIPTION</th><th style={{textAlign:'right'}}>PRICE</th></tr></thead>
                        <tbody>
                            {(item.list||[]).map((i,x)=><tr key={x} style={{borderBottom:'1px solid #f1f5f9'}}>
                                <td style={{padding:'12px 0', color:'#334155'}}>{i.desc}</td>
                                <td style={{textAlign:'right', fontWeight:'500'}}>£{(i.p||0).toFixed(2)} <span className="no-print" onClick={()=>actions.delItem(x)} style={{color:'#ef4444', marginLeft:'10px', cursor:'pointer', fontWeight:'bold'}}>×</span></td>
                            </tr>)}
                        </tbody>
                    </table>

                    <div style={{background:'#f8fafc', padding:15, borderRadius:10}}>
                        <div style={{display:'flex', justifyContent:'space-between', marginBottom:8, alignItems:'center'}}>
                            <span style={{color:'#64748b'}}>Labour Hours</span>
                            <div style={{display:'flex', alignItems:'center', gap:5}}>
                                <input type="number" value={fin.lh} onChange={e=>setFin({...fin, lh:e.target.value})} style={{width:'60px', padding:'6px', border:'1px solid #cbd5e1', borderRadius:'6px', textAlign:'center'}}/>
                                <span style={{fontSize:'12px', color:'#94a3b8'}}>@ £{fin.lr}/hr</span>
                            </div>
                        </div>
                        <div style={{display:'flex', justifyContent:'space-between', marginBottom:8, alignItems:'center'}}>
                            <span style={{color:'#64748b'}}>Paint Materials</span>
                            <input type="number" value={fin.paint} onChange={e=>setFin({...fin, paint:e.target.value})} style={{width:'80px', padding:'6px', border:'1px solid #cbd5e1', borderRadius:'6px', textAlign:'right'}} placeholder="£"/>
                        </div>
                        <div style={{display:'flex', justifyContent:'space-between', marginBottom:15, alignItems:'center'}}>
                            <span style={{color:'#64748b'}}>VAT ({cfg.vatRate}%)</span>
                            <span style={{fontWeight:'600'}}>£{totals.vat.toFixed(2)}</span>
                        </div>
                        
                        <div style={{borderTop:'2px dashed #cbd5e1', paddingTop:15, display:'flex', justifyContent:'space-between', alignItems:'center'}}>
                            <span style={{fontSize:'18px', fontWeight:'800', color:'#1e293b'}}>TOTAL</span>
                            <span style={{fontSize:'24px', fontWeight:'800', color:'#16a34a'}}>£{totals.invoiceTotal.toFixed(2)}</span>
                        </div>
                    </div>
                    {/* --- QR CODE START --- */}
                    <div style={{marginTop: 20, marginBottom: 20, textAlign: 'center', padding: 10, border: '1px dashed #ccc'}}>
                        <QRCodeSVG value={`https://www.paypal.com/paypalme/markmonie/${totals.invoiceTotal.toFixed(2)}`} size={128} />
                        <div style={{fontSize: 10, marginTop: 5}}>Scan to Pay £{totals.invoiceTotal.toFixed(2)}</div>
                    </div>
                    {/* --- QR CODE END --- */}

                    <div className="no-print" style={{marginTop:20, paddingTop:15, borderTop:'1px solid #e2e8f0'}}>
                        <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:15}}>
                            <label style={{...s.label, marginBottom:0}}>LESS EXCESS:</label>
                            <input style={{...s.inp, marginBottom:0, width:100, textAlign:'right'}} placeholder="- £" value={fin.ex} onChange={e=>setFin({...fin, ex:e.target.value})}/>
                        </div>
                        
                        {/* INVOICE GENERATION BUTTONS */}
                        <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:10}}>
                            <button onClick={()=>actions.save('INVOICE_MAIN')} style={{...s.btn, background:'#2563eb', padding:'12px'}}>🏢 Invoice Company</button>
                            <button onClick={()=>actions.save('INVOICE_EXCESS')} style={{...s.btn, background:'#ea580c', padding:'12px'}}>👤 Invoice Excess</button>
                        </div>
                    </div>
                </div>

                {mode.includes('INVOICE') && <div style={{marginTop:40, padding:20, border:'1px solid #e2e8f0', background:'#fff', borderRadius:10}}>
                    <div style={{display:'flex', justifyContent:'space-between'}}>
                        <div><b>PAYMENT INFO</b><br/>{cfg.companyName}<br/>Sort: 80-22-60<br/>Acc: 06163462</div>
                        <div style={{textAlign:'center'}}><canvas ref={canvasRef} width={200} height={80} style={{border:'1px dashed #ccc', background:'#f9f9f9', borderRadius:6}} onTouchStart={startD} onTouchMove={moveD} onTouchEnd={()=>setDraw(false)} onMouseDown={startD} onMouseMove={moveD} onMouseUp={()=>setDraw(false)} /><br/><small style={{color:'#94a3b8'}}>Customer Signature</small></div>
                    </div>
                </div>}
            </div>}

            {/* SCROLLABLE BOTTOM DOCK (ALL ACTIONS) */}
            <div className="no-print" style={{position:'fixed', bottom:0, left:0, right:0, background:'#fff', padding:'12px 10px', boxShadow:'0 -4px 20px rgba(0,0,0,0.05)', display:'flex', gap:'15px', overflowX:'auto', borderTop:'1px solid #e2e8f0', zIndex:100, alignItems:'center'}}>
                
                {/* 1. SAVE (Most important, leftmost or stick to left) */}
                <button onClick={()=>actions.save('ESTIMATE')} style={{...s.btn, ...s.saveBtn, padding:'10px 20px', borderRadius:'20px', flexShrink:0, boxShadow:'0 4px 10px rgba(22, 163, 74, 0.3)'}}>💾 SAVE</button>
                
                {/* 2. Navigation */}
                <button onClick={()=>setMode('ESTIMATE')} style={s.dockItem}><span style={{fontSize:'20px'}}>📝</span>Estimate</button>
                <button onClick={()=>setMode('JOBCARD')} style={s.dockItem}><span style={{fontSize:'20px'}}>🔧</span>Job Card</button>
                <button onClick={()=>setMode('DEAL_FILE')} style={s.dockItem}><span style={{fontSize:'20px'}}>📁</span>File</button>
                <button onClick={()=>setMode('DASHBOARD')} style={s.dockItem}><span style={{fontSize:'20px'}}>📊</span>Dash</button>
                
                {/* 3. Tools */}
                <div style={{width:1, height:30, background:'#e2e8f0', flexShrink:0}}></div>
                <button onClick={actions.newJob} style={s.dockItem}><span style={{fontSize:'20px'}}>➕</span>New</button>
                <button onClick={handlePrint} style={s.dockItem}><span style={{fontSize:'20px'}}>🖨️</span>Print</button>
                <button onClick={()=>setMode('SETTINGS')} style={s.dockItem}><span style={{fontSize:'20px'}}>⚙️</span>Config</button>
            </div>

            {/* SEARCH LIST (Moved to its own card style) */}
            <div className="no-print" style={{marginTop:40, paddingBottom:80}}>
                <input placeholder="🔍 Search Jobs..." value={sys.search} onChange={e=>setSys({...sys, search:e.target.value})} style={{...s.inp, borderRadius:'25px', padding:'12px 20px', border:'1px solid #cbd5e1', boxShadow:'0 2px 5px rgba(0,0,0,0.05)'}}/>
                {sys.jobs.filter(j=>(j.customer+j.reg).toLowerCase().includes(sys.search.toLowerCase())).map(j=><div key={j.id} style={{padding:'15px', borderBottom:'1px solid #f1f5f9', background:j.status==='PAID'?'#f0fdf4':'#fff', display:'flex', justifyContent:'space-between', alignItems:'center', borderRadius:10, marginBottom:8, boxShadow:'0 1px 2px rgba(0,0,0,0.02)'}} onClick={()=>actions.load(j)}>
                    <div>
                        <div style={{fontWeight:'700', color:'#1e293b'}}>{j.customer}</div>
                        <div style={{fontSize:'12px', color:'#64748b'}}>{j.reg} • {new Date(j.createdAt?.seconds*1000).toLocaleDateString()}</div>
                    </div>
                    <div style={{textAlign:'right'}}>
                        <div style={{fontWeight:'800', color:'#1e293b', fontSize:'16px'}}>£{(j.totals?.finalDue || j.totals?.due || 0).toFixed(0)}</div>
                        <div style={{display:'flex', gap:10, marginTop:5, justifyContent:'flex-end'}}>
                            <button onClick={(e)=>{e.stopPropagation(); actions.pay(j.id, j.status)}} style={{border:'none', background:'none', cursor:'pointer', fontSize:'16px'}}>{j.status==='PAID'?'✅':'💰'}</button>
                            <button onClick={(e)=>{e.stopPropagation(); actions.delJob(j.id)}} style={{border:'none', background:'none', cursor:'pointer', fontSize:'16px', color:'#ef4444'}}>🗑️</button>
                        </div>
                    </div>
                </div>)}
            </div>
            
            <style>{`@media print { .no-print { display: none !important; } body { padding: 0; margin: 0; background: white; } input, textarea { border: none !important; resize: none; padding: 0 !important; background: transparent !important; } }`}</style>
        </div>
    );
};

const App = () => { 
    const [u, setU] = useState(null); 
    useEffect(() => { return onAuthStateChanged(auth, user => { if (user) setU(user.uid); else signInAnonymously(auth).catch(e=>console.error(e)); }); }, []); 
    return u ? <ErrorBoundary><EstimateApp userId={u} /></ErrorBoundary> : <div style={{padding:20, fontFamily:'sans-serif'}}>Loading System...</div>; 
};
export default App;
