import React, { useState, useEffect, useRef } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, collection, addDoc, updateDoc, doc, onSnapshot, query, orderBy, serverTimestamp, getDocs, setDoc, getDoc, deleteDoc } from 'firebase/firestore';
import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import axios from 'axios';

// --- CONFIG ---
const firebaseConfig = {
  apiKey: "AIzaSyDVfPvFLoL5eqQ3WQB96n08K3thdclYXRQ",
  authDomain: "triple-mmm-body-repairs.firebaseapp.com",
  projectId: "triple-mmm-body-repairs",
  storageBucket: "triple-mmm-body-repairs.firebasestorage.app",
  messagingSenderId: "110018101133",
  appId: "1:110018101133:web:63b0996c7050c4967147c4",
  measurementId: "G-NRDPCR0SR2"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);
const storage = getStorage(app);

// --- STYLES ---
const s = {
    input: { width: '100%', padding: '8px', marginBottom: '8px', borderRadius: '4px', border: '1px solid #ccc' },
    label: { fontWeight: 'bold', display: 'block', marginBottom: '4px', fontSize: '0.8em', color: '#666' },
    section: { background: 'white', padding: '15px', borderRadius: '8px', border: '1px solid #eee', marginBottom: '20px' },
    btn: { padding: '10px 20px', borderRadius: '6px', border: 'none', cursor: 'pointer', fontWeight: 'bold', color: 'white' },
    primary: { background: '#16a34a' }, 
    secondary: { background: '#4b5563' },
    danger: { background: '#dc2626' }
};

const EstimateApp = ({ userId }) => {
    // --- STATE MANAGEMENT (MODERN OBJECT ARCHITECTURE) ---
    
    // SYS: System State (Mode, ID, Lists, Config)
    const [sys, setSys] = useState({
        mode: 'ESTIMATE', // ESTIMATE, INVOICE, JOBCARD, DEAL_FILE, DASHBOARD, SETTINGS
        save: 'IDLE', // IDLE, SAVING, SAVED
        id: null, // Current Job ID
        invNum: '',
        invDate: '',
        notes: [], // Job History Notes
        jobs: [], // Saved Jobs List
        expenses: [], // Expense List
        cfg: { labor: '50', markup: '20', vat: '0', dvla: '', company: 'TRIPLE MMM', addr: '20A New Street, Stonehouse, ML9 3LT', phone: '07501 728319', email: 'markmonie72@gmail.com' }
    });

    // CUST: Customer Details
    const [cust, setCust] = useState({ n: '', a: '', p: '', e: '', c: '', nc: '', ins: '', ie: '' }); // ie = Insurance Email
    
    // VEH: Vehicle Details
    const [veh, setVeh] = useState({ r: '', m: '', mm: '', v: '', p: '', c: '', info: {} }); // info = DVLA Data
    
    // ITEM: Line Items
    const [item, setItem] = useState({ list: [], d: '', c: '' }); // list of {desc, price, cost}
    
    // FIN: Financials
    const [fin, setFin] = useState({ lh: '', lr: '50', vr: '0', ex: '0', pa: '' }); // pa = Paint Allocated
    
    // FILES: Photos & Docs
    const [files, setFiles] = useState([]); // Damage Photos
    const [deal, setDeal] = useState({}); // Deal File Docs (Auth, Terms, etc)

    const canvasRef = useRef(null);
    const [isDrawing, setIsDrawing] = useState(false);

    // --- INITIALIZATION ---
    useEffect(() => {
        // Load Settings
        getDoc(doc(db, 'settings', 'global')).then(snap => {
            if(snap.exists()) setSys(p => ({...p, cfg: {...p.cfg, ...snap.data()}}));
        });
        // Load Jobs
        const unsub = onSnapshot(query(collection(db, 'estimates'), orderBy('createdAt', 'desc')), (snap) => {
            setSys(p => ({...p, jobs: snap.docs.map(d => ({id: d.id, ...d.data()}))}));
        });
        return () => unsub();
    }, []);

    // --- LOGIC ENGINE ---
    
    const actions = {
        // 1. CALCULATE TOTALS
        calc: () => {
            const partsSale = item.list.reduce((a, i) => a + (parseFloat(i.price)||0), 0);
            const laborSale = (parseFloat(fin.lh)||0) * (parseFloat(fin.lr)||parseFloat(sys.cfg.labor));
            const subtotal = partsSale + laborSale;
            const excess = parseFloat(fin.ex) || 0;
            const total = subtotal - excess;
            return { partsSale, laborSale, subtotal, excess, total };
        },

        // 2. LOAD JOB
        load: (j) => {
            setSys(p=>({...p, mode: 'DEAL_FILE', id: j.id, invNum: j.invoiceNumber, invDate: j.date, notes: j.notes || [] }));
            setCust({ n: j.name, a: j.address, p: j.phone, e: j.email, c: j.claim, nc: j.networkCode, ins: j.ins, ie: j.insEmail });
            setVeh({ r: j.reg, m: j.mileage, mm: j.makeModel, v: j.vin, p: j.paintCode, info: j.vehicleInfo || {} });
            setItem({ list: j.items || [], d:'', c:'' });
            setFin({ lh: j.laborHours, lr: j.laborRate, vr: j.vatRate, ex: j.excess, pa: j.paintAllocated });
            setFiles(j.photos || []);
            setDeal(j.dealFile || {});
            window.scrollTo(0,0);
        },

        // 3. SAVE JOB (THE FINAL FIX)
        save: async (type) => {
            if(!cust.n || !veh.r) return alert("Name and Registration required");
            setSys(p=>({...p, save:'SAVING...'}));

            try {
                let n = sys.invNum, t = type;
                let currentNotes = [...(sys.notes || [])];

                // Invoice Logic
                if(type.includes('INVOICE') && !n) { 
                    n = `INV-${Date.now()}`; 
                    setSys(p=>({...p, invNum: n})); 
                }
                
                if(type === 'INVOICE_MAIN') { setSys(p=>({...p, mode:'INVOICE'})); }
                else if (type === 'INVOICE_EXCESS') { 
                    setSys(p=>({...p, mode:'INVOICE'})); t='INVOICE (EXCESS)'; 
                    currentNotes.push({text: 'Excess Invoice Generated', date: new Date().toISOString()});
                }
                else setSys(p=>({...p, mode:type}));

                // DATA PACKET (With Safety Nets)
                const data = {
                    type: t,
                    status: 'UNPAID',
                    invoiceNumber: n || '',
                    date: new Date().toISOString(),
                    name: cust.n || '',
                    address: cust.a || '',
                    phone: cust.p || '',
                    email: cust.e || '',
                    claim: cust.c || '',
                    networkCode: cust.nc || '',
                    ins: cust.ins || '',
                    insEmail: cust.ie || '', // Fixes the crash
                    
                    reg: veh.r || '',
                    mileage: veh.m || '',
                    makeModel: veh.mm || '',
                    vin: veh.v || '',
                    paintCode: veh.p || '',
                    vehicleInfo: veh.info || {},
                    
                    items: item.list || [],
                    laborHours: fin.lh || '',
                    laborRate: fin.lr || sys.cfg.labor,
                    excess: fin.ex || '0',
                    paintAllocated: fin.pa || '',
                    
                    photos: files || [],
                    dealFile: deal || {},
                    notes: currentNotes,
                    
                    createdAt: serverTimestamp(), 
                    createdBy: userId
                };

                // DATABASE SEND
                if(sys.id) {
                    await updateDoc(doc(db, 'estimates', sys.id), data);
                } else {
                    const r = await addDoc(collection(db, 'estimates'), data);
                    setSys(p=>({...p, id: r.id}));
                }

                setSys(p=>({...p, save:'SAVED!'}));
                setTimeout(()=>setSys(p=>({...p, save:'IDLE'})), 2000);

            } catch(e) {
                alert("Save Error: " + e.message);
                setSys(p=>({...p, save:'IDLE'}));
            }
        },

        // 4. BATCH PHOTO UPLOAD
        uploadPhoto: async (e) => {
            const fileList = Array.from(e.target.files);
            if(fileList.length === 0) return;
            
            setSys(p=>({...p, save:'UPLOADING...'}));
            try {
                const promises = fileList.map(async (file) => {
                    const r = ref(storage, `photos/${Date.now()}_${file.name}`);
                    await uploadBytes(r, file);
                    return getDownloadURL(r);
                });
                const urls = await Promise.all(promises);
                setFiles(prev => [...prev, ...urls]);
                setSys(p=>({...p, save:'IDLE'}));
            } catch(e) { alert("Upload error"); }
        },

        // 5. DOC UPLOAD (ASYNC FIX)
        uploadDoc: async (type, file) => {
            if(!sys.id) return alert("Save job first");
            if(!file) return;
            try {
                const r = ref(storage, `docs/${sys.id}/${type}_${file.name}`);
                await uploadBytes(r, file);
                const url = await getDownloadURL(r);
                const newDoc = { name: file.name, url, date: new Date().toLocaleDateString() };
                
                const newDeal = { ...deal, [type]: newDoc };
                setDeal(newDeal);
                await updateDoc(doc(db, 'estimates', sys.id), { dealFile: newDeal });
                alert("Uploaded!");
            } catch(e) { alert(e.message); }
        },

        // 6. DVLA LOOKUP
        lookup: async () => {
            if(!veh.r || veh.r.length < 3) return alert("Enter Reg");
            try {
                const res = await axios.post('https://driver-vehicle-licensing.api.gov.uk/vehicle-enquiry/v1/vehicles', 
                    { registrationNumber: veh.r }, 
                    { headers: { 'x-api-key': sys.cfg.dvla } });
                setVeh(p=>({...p, mm: `${res.data.make} ${res.data.colour}`, info: res.data}));
            } catch(e) { alert("Vehicle not found (Check API Key)"); }
        },
        
        newItem: () => {
            if(!item.d) return;
            const cost = parseFloat(item.c) || 0;
            const price = cost * (1 + (parseFloat(sys.cfg.markup)/100));
            setItem(p=>({...p, list: [...p.list, {desc: p.d, cost, price}], d:'', c:''}));
        },

        clear: () => {
            if(window.confirm("Start New?")) {
                setSys(p=>({...p, mode:'ESTIMATE', id:null, invNum:'', notes:[]}));
                setCust({n:'',a:'',p:'',e:'',c:'',nc:'',ins:'',ie:''});
                setVeh({r:'',m:'',mm:'',v:'',p:'',c:'',info:{}});
                setItem({list:[],d:'',c:''});
                setFin({lh:'',lr:sys.cfg.labor,vr:'0',ex:'0',pa:''});
                setFiles([]);
                setDeal({});
            }
        }
    };

    // --- RENDER ---
    const totals = actions.calc();

    // 1. SETTINGS VIEW
    if(sys.mode === 'SETTINGS') return (
        <div style={{padding:'20px', maxWidth:'600px', margin:'0 auto'}}>
            <h2>⚙️ Settings</h2>
            <label style={s.label}>Company Name</label><input style={s.input} value={sys.cfg.company} onChange={e=>setSys(p=>({...p, cfg:{...p.cfg, company:e.target.value}}))} />
            <label style={s.label}>Address</label><textarea style={s.input} value={sys.cfg.addr} onChange={e=>setSys(p=>({...p, cfg:{...p.cfg, addr:e.target.value}}))} />
            <label style={s.label}>DVLA Key</label><input style={s.input} value={sys.cfg.dvla} onChange={e=>setSys(p=>({...p, cfg:{...p.cfg, dvla:e.target.value}}))} />
            <button onClick={()=>setSys(p=>({...p, mode:'ESTIMATE'}))} style={{...s.btn, ...s.secondary}}>Back</button>
            <button onClick={()=>setDoc(doc(db,'settings','global'), sys.cfg).then(()=>alert("Saved"))} style={{...s.btn, ...s.primary, marginLeft:'10px'}}>Save</button>
        </div>
    );

    // 2. DASHBOARD VIEW
    if(sys.mode === 'DASHBOARD') return (
        <div style={{padding:'20px'}}>
            <h2>📊 Dashboard</h2>
            <button onClick={()=>setSys(p=>({...p, mode:'ESTIMATE'}))} style={{...s.btn, ...s.secondary}}>Back</button>
            <div style={{marginTop:'20px'}}>
                {sys.jobs.map(j => (
                    <div key={j.id} style={{padding:'10px', borderBottom:'1px solid #ccc', cursor:'pointer'}} onClick={()=>actions.load(j)}>
                        <strong>{j.reg}</strong> - {j.name} ({j.invoiceNumber || 'Est'})
                    </div>
                ))}
            </div>
        </div>
    );

    // 3. MAIN APP (ESTIMATE / INVOICE / DEAL FILE)
    return (
        <div style={{padding:'20px', maxWidth:'1000px', margin:'0 auto', fontFamily:'Arial'}}>
            {/* HEADER */}
            <div style={{display:'flex', justifyContent:'space-between', borderBottom:'4px solid #cc0000', paddingBottom:'10px', marginBottom:'20px'}}>
                <div><h1 style={{margin:0, color:'#cc0000'}}>TRIPLE MMM</h1><small>BODY REPAIRS</small></div>
                <div style={{textAlign:'right', fontSize:'0.8em'}}>
                    {sys.cfg.addr}<br/>{sys.cfg.phone}<br/>{sys.cfg.email}
                </div>
            </div>

            {/* TITLE BAR */}
            <div style={{display:'flex', justifyContent:'space-between', marginBottom:'20px'}}>
                <h2>{sys.mode === 'DEAL_FILE' ? '📂 DEAL FILE' : sys.mode}</h2>
                <div>
                    {sys.invNum && <strong>{sys.invNum}<br/></strong>}
                    {new Date().toLocaleDateString()}
                </div>
            </div>

            {/* FORM AREA */}
            {sys.mode !== 'DEAL_FILE' && (
            <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:'20px'}}>
                {/* CUSTOMER */}
                <div style={s.section}>
                    <h4 style={{color:'#cc0000', marginTop:0}}>CUSTOMER</h4>
                    <input placeholder="Name" style={s.input} value={cust.n} onChange={e=>setCust({...cust, n:e.target.value})} />
                    <textarea placeholder="Address" style={s.input} value={cust.a} onChange={e=>setCust({...cust, a:e.target.value})} />
                    <div style={{display:'flex', gap:'5px'}}>
                        <input placeholder="Phone" style={s.input} value={cust.p} onChange={e=>setCust({...cust, p:e.target.value})} />
                        <input placeholder="Email" style={s.input} value={cust.e} onChange={e=>setCust({...cust, e:e.target.value})} />
                    </div>
                    {/* INSURANCE */}
                    <h4 style={{color:'#cc0000', marginBottom:'5px'}}>INSURANCE</h4>
                    <input placeholder="Company" style={s.input} value={cust.ins} onChange={e=>setCust({...cust, ins:e.target.value})} />
                    <input placeholder="Ins Email (For Invoices)" style={s.input} value={cust.ie} onChange={e=>setCust({...cust, ie:e.target.value})} />
                    <div style={{display:'flex', gap:'5px'}}>
                        <input placeholder="Claim #" style={s.input} value={cust.c} onChange={e=>setCust({...cust, c:e.target.value})} />
                        <input placeholder="Network Code" style={s.input} value={cust.nc} onChange={e=>setCust({...cust, nc:e.target.value})} />
                    </div>
                </div>

                {/* VEHICLE */}
                <div style={s.section}>
                    <h4 style={{color:'#cc0000', marginTop:0}}>VEHICLE</h4>
                    <div style={{display:'flex', gap:'5px'}}>
                        <input placeholder="REG" style={{...s.input, fontWeight:'bold', textTransform:'uppercase'}} value={veh.r} onChange={e=>setVeh({...veh, r:e.target.value.toUpperCase()})} />
                        <button onClick={actions.lookup} style={{...s.btn, ...s.secondary, padding:'5px 10px', height:'35px'}}>🔎</button>
                    </div>
                    {veh.info.fuelType && <small style={{color:'green'}}>✓ {veh.info.yearOfManufacture} {veh.info.make} ({veh.info.fuelType})</small>}
                    <input placeholder="Make/Model" style={s.input} value={veh.mm} onChange={e=>setVeh({...veh, mm:e.target.value})} />
                    <input placeholder="Mileage" style={s.input} value={veh.m} onChange={e=>setVeh({...veh, m:e.target.value})} />
                    <input placeholder="VIN" style={s.input} value={veh.v} onChange={e=>setVeh({...veh, v:e.target.value})} />
                    <input placeholder="Paint Code" style={s.input} value={veh.p} onChange={e=>setVeh({...veh, p:e.target.value})} />
                    
                    {/* BATCH UPLOAD */}
                    <div style={{marginTop:'10px', border:'1px dashed #ccc', padding:'10px', background:'#f9f9f9'}}>
                        <label style={s.label}>📸 Add Photos (Select Multiple)</label>
                        <input type="file" multiple accept="image/*" onChange={actions.uploadPhoto} />
                        {sys.save === 'UPLOADING...' && <span style={{color:'green'}}>Uploading...</span>}
                    </div>
                </div>
            </div>
            )}

            {/* PHOTOS STRIP */}
            {files.length > 0 && sys.mode !== 'DEAL_FILE' && (
                <div style={{display:'flex', gap:'5px', overflowX:'auto', padding:'10px 0', marginBottom:'20px'}}>
                    {files.map((u,i) => <img key={i} src={u} style={{height:'80px', borderRadius:'4px', border:'1px solid #ccc'}} alt="dm" />)}
                </div>
            )}

            {/* LINE ITEMS */}
            {sys.mode !== 'DEAL_FILE' && (
            <div style={s.section}>
                <table style={{width:'100%', borderCollapse:'collapse'}}>
                    <thead><tr style={{borderBottom:'2px solid #ccc', textAlign:'left'}}><th>Description</th><th style={{textAlign:'right'}}>Price</th></tr></thead>
                    <tbody>
                        {item.list.map((l,i) => (
                            <tr key={i} style={{borderBottom:'1px solid #eee'}}>
                                <td style={{padding:'8px'}}>{l.desc}</td>
                                <td style={{padding:'8px', textAlign:'right'}}>£{l.price.toFixed(2)}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
                <div className="no-print" style={{display:'flex', gap:'5px', marginTop:'10px', background:'#f0fdf4', padding:'10px'}}>
                    <input placeholder="Description" style={{...s.input, marginBottom:0}} value={item.d} onChange={e=>setItem({...item, d:e.target.value})} />
                    <input placeholder="Cost" type="number" style={{...s.input, width:'80px', marginBottom:0}} value={item.c} onChange={e=>setItem({...item, c:e.target.value})} />
                    <button onClick={actions.newItem} style={{...s.btn, ...s.primary}}>Add</button>
                </div>
            </div>
            )}

            {/* TOTALS */}
            {sys.mode !== 'DEAL_FILE' && (
            <div style={{display:'flex', justifyContent:'flex-end', marginBottom:'20px'}}>
                <div style={{width:'300px', textAlign:'right'}}>
                    <div style={rowStyle}>Labor: <input value={fin.lh} onChange={e=>setFin({...fin, lh:e.target.value})} style={{width:'50px'}}/> hrs @ £{sys.cfg.labor}</div>
                    <div style={rowStyle}><strong>Labor Total:</strong> £{totals.laborSale.toFixed(2)}</div>
                    <div style={rowStyle}><strong>Parts Total:</strong> £{totals.partsSale.toFixed(2)}</div>
                    <div style={{...rowStyle, fontSize:'1.2em', borderTop:'2px solid black'}}><strong>Total:</strong> £{totals.subtotal.toFixed(2)}</div>
                    <div style={{...rowStyle, color:'red'}}>Less Excess: <input value={fin.ex} onChange={e=>setFin({...fin, ex:e.target.value})} style={{width:'60px'}}/> -£{totals.excess.toFixed(2)}</div>
                    <div style={{...rowStyle, fontSize:'1.4em', background:'#eee', padding:'5px'}}><strong>DUE:</strong> £{totals.total.toFixed(2)}</div>
                </div>
            </div>
            )}

            {/* DEAL FILE VIEW */}
            {sys.mode === 'DEAL_FILE' && (
                <div style={s.section}>
                    <h3>📂 Digital Deal File: {veh.r}</h3>
                    <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:'20px'}}>
                        <div>
                            <h4>Documents</h4>
                            {[
                                {k:'auth', l:'Insurer Authority'},
                                {k:'terms', l:'Signed T&Cs'},
                                {k:'sat', l:'Satisfaction Note'}
                            ].map(d => (
                                <div key={d.k} style={{marginBottom:'10px', padding:'10px', border:'1px solid #eee'}}>
                                    <div style={{display:'flex', justifyContent:'space-between'}}>
                                        <strong>{d.l}</strong>
                                        <span>{deal[d.k] ? '✅' : '❌'}</span>
                                    </div>
                                    <input type="file" onChange={(e)=>actions.uploadDoc(d.k, e.target.files[0])} />
                                    {deal[d.k] && <a href={deal[d.k].url} target="_blank" rel="noreferrer">View</a>}
                                </div>
                            ))}
                        </div>
                        <div>
                            <h4>Checklist</h4>
                            <div>📸 Photos: {files.length}</div>
                            <div>💰 Invoice: {sys.invNum || 'Pending'}</div>
                            <button onClick={()=>window.location.href=`mailto:?subject=Repair Pack ${veh.r}&body=See attached.`} style={{...s.btn, ...s.primary, marginTop:'20px', width:'100%'}}>📧 Create Email Pack</button>
                        </div>
                    </div>
                </div>
            )}

            {/* CONTROLS */}
            <div className="no-print" style={{position:'fixed', bottom:0, left:0, width:'100%', background:'white', borderTop:'1px solid #ccc', padding:'15px', display:'flex', justifyContent:'center', gap:'10px'}}>
                <button onClick={()=>actions.save('ESTIMATE')} style={{...s.btn, ...s.primary}}>{sys.save === 'SAVING...' ? 'SAVING...' : 'SAVE'}</button>
                <button onClick={()=>actions.save('INVOICE_MAIN')} style={{...s.btn, ...s.secondary}}>INVOICE (INS)</button>
                <button onClick={()=>actions.save('INVOICE_EXCESS')} style={{...s.btn, ...s.danger}}>INVOICE (CUST)</button>
                <button onClick={()=>setSys(p=>({...p, mode:'JOBCARD'}))} style={{...s.btn, ...s.secondary}}>JOB CARD</button>
                <button onClick={()=>setSys(p=>({...p, mode:'DEAL_FILE'}))} style={{...s.btn, ...s.secondary}}>DEAL FILE</button>
                <button onClick={()=>window.print()} style={{...s.btn, ...s.secondary}}>PRINT</button>
                <button onClick={()=>setSys(p=>({...p, mode:'SETTINGS'}))} style={{...s.btn, ...s.secondary}}>⚙️</button>
                <button onClick={()=>setSys(p=>({...p, mode:'DASHBOARD'}))} style={{...s.btn, ...s.secondary}}>📊</button>
                <button onClick={actions.clear} style={{...s.btn, ...s.danger}}>NEW</button>
            </div>
        </div>
    );
};

// --- APP WRAPPER ---
const App = () => {
    const [u, sU] = useState(null);
    useEffect(() => onAuthStateChanged(auth, (user) => user ? sU(user.uid) : signInAnonymously(auth)), []);
    if (!u) return <div>Loading...</div>;
    return <EstimateApp userId={u} />;
};

export default App;
