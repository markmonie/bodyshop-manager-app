import React, { useState, useEffect, useMemo } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, collection, addDoc, updateDoc, doc, onSnapshot, query, orderBy, serverTimestamp, setDoc, getDoc, deleteDoc } from 'firebase/firestore';
import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage';

// --- CONFIGURATION ---
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

// --- DESIGN SYSTEM ---
const theme = { bg: '#0f172a', card: '#1e293b', accent: '#f97316', text: '#f8fafc', textDim: '#94a3b8', success: '#16a34a', danger: '#ef4444', border: '#334155' };
const s = {
    card: { background: theme.card, borderRadius: '16px', padding: '20px', marginBottom: '20px', border: `1px solid ${theme.border}`, boxShadow: '0 4px 20px rgba(0,0,0,0.5)' },
    input: { width: '100%', background: '#0f172a', border: `1px solid ${theme.border}`, color: theme.text, padding: '12px', borderRadius: '8px', marginBottom: '10px', outline: 'none' },
    label: { color: theme.accent, fontSize: '11px', fontWeight: 'bold', textTransform: 'uppercase', marginBottom: '4px', display: 'block' },
    btnGreen: { background: theme.success, color: 'white', border: 'none', padding: '14px 24px', borderRadius: '12px', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' },
    secondaryBtn: { background: '#334155', color: 'white', border: 'none', padding: '12px 20px', borderRadius: '12px', fontWeight: 'bold', cursor: 'pointer' }
};

const EstimateApp = ({ userId }) => {
    const [page, setPage] = useState('WORKSHOP'); 
    const [loading, setLoading] = useState(false);
    const [currentJobId, setCurrentJobId] = useState(null);

    const [settings, setSettings] = useState({
        coName: 'Triple MMM Body Repairs', address: '20A New Street, Stonehouse, ML9 3LT', phone: '07501 728319',
        bank: '80-22-60 | 06163462', vatRate: '0', markup: '20', labourRate: '50', dvlaKey: 'IXqv1yDD1latEPHIntk2w8MEuz9X57IE9TP9sxGc',
        logoUrl: '', paypalQr: ''
    });

    const [customer, setCustomer] = useState({ name: '', phone: '', email: '', address: '' });
    const [vehicle, setVehicle] = useState({ reg: '', makeModel: '', vin: '', paint: '' });
    const [insurance, setInsurance] = useState({ co: '', claim: '', network: '', address: '' });
    const [repair, setRepair] = useState({ items: [], labourHours: '', paintMaterials: '', excess: '0', dealFile: { auth: '', sat: '', tc: '', inv: '' } });
    const [savedJobs, setSavedJobs] = useState([]);

    useEffect(() => {
        getDoc(doc(db, 'settings', 'global')).then(snap => snap.exists() && setSettings(prev => ({...prev, ...snap.data()})));
        return onSnapshot(query(collection(db, 'estimates'), orderBy('createdAt', 'desc')), (snap) => setSavedJobs(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
    }, []);

    const totals = useMemo(() => {
        const pCost = (repair.items || []).reduce((a, b) => a + (parseFloat(b.cost) || 0), 0);
        const pPrice = pCost * (1 + (parseFloat(settings.markup || 20) / 100));
        const labour = (parseFloat(repair.labourHours) || 0) * (parseFloat(settings.labourRate || 50) || 0);
        const paint = parseFloat(repair.paintMaterials) || 0;
        const sub = pPrice + labour + paint;
        const vat = sub * (parseFloat(settings.vatRate || 0) / 100);
        const total = sub + vat;
        const excess = parseFloat(repair.excess || 0);
        return { total, customerDue: excess, insuranceDue: total - excess, netProfit: total - (pCost + paint), labourPrice: labour, paintPrice: paint, pPrice, vat };
    }, [repair, settings]);

    const handleUpload = async (e, path, field) => {
        const file = e.target.files[0]; if (!file) return;
        const r = ref(storage, `${path}/${Date.now()}_${file.name}`);
        await uploadBytes(r, file);
        const url = await getDownloadURL(r);
        if (path === 'branding') setSettings(prev => ({...prev, [field]: url}));
        else setRepair(prev => ({...prev, dealFile: {...prev.dealFile, [field]: url}}));
    };

    const addPart = () => {
        const n = document.getElementById('partName'), c = document.getElementById('partCost');
        if (!n.value || !c.value) return;
        setRepair({...repair, items: [...repair.items, { desc: n.value, cost: c.value }]});
        n.value = ''; c.value = '';
    };

    return (
        <div style={{ background: theme.bg, minHeight: '100vh', color: theme.text, padding: '20px', paddingBottom: '120px' }}>
            <div className="no-print" style={{ display: 'flex', gap: '15px', borderBottom: `1px solid ${theme.border}`, marginBottom: '20px', paddingBottom: '10px' }}>
                <button onClick={() => setPage('WORKSHOP')} style={page === 'WORKSHOP' ? {color:theme.accent, background:'none', border:'none', fontWeight:'bold'} : {color:theme.textDim, background:'none', border:'none'}}>WORKSHOP</button>
                <button onClick={() => setPage('INSURANCE')} style={page === 'INSURANCE' ? {color:theme.accent, background:'none', border:'none', fontWeight:'bold'} : {color:theme.textDim, background:'none', border:'none'}}>INSURANCE PACK</button>
                <button onClick={() => setPage('SETTINGS')} style={page === 'SETTINGS' ? {color:theme.accent, background:'none', border:'none', fontWeight:'bold'} : {color:theme.textDim, background:'none', border:'none'}}>SETTINGS</button>
            </div>

            {page === 'WORKSHOP' && (
                <>
                    <div style={s.card}>
                        <span style={s.label}>Add Repair Parts (Cost Price)</span>
                        <div style={{display:'flex', gap:'10px', marginBottom:'10px'}}>
                            <input id="partName" placeholder="Part Name" style={{...s.input, flex:2, marginBottom:0}} />
                            <input id="partCost" type="number" placeholder="Cost £" style={{...s.input, flex:1, marginBottom:0}} />
                            <button onClick={addPart} style={s.btnGreen}>+</button>
                        </div>
                        {repair.items.map((it, i) => (
                            <div key={i} style={{display:'flex', justifyContent:'space-between', padding:'8px 0', borderBottom:'1px solid #334155'}}>
                                <span>{it.desc}</span>
                                <strong>£{(parseFloat(it.cost)*(1+(settings.markup/100))).toFixed(2)}</strong>
                            </div>
                        ))}
                    </div>

                    <div style={{...s.card, background:theme.accent}}>
                        <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:'15px'}}>
                            <div><span style={s.label}>Labour Hours</span><input type="number" style={{...s.input, background:'rgba(0,0,0,0.2)'}} value={repair.labourHours} onChange={e => setRepair({...repair, labourHours: e.target.value})} /></div>
                            <div><span style={s.label}>Excess (Customer) £</span><input type="number" style={{...s.input, background:'rgba(0,0,0,0.2)'}} value={repair.excess} onChange={e => setRepair({...repair, excess: e.target.value})} /></div>
                        </div>
                        <div style={{display:'flex', justifyContent:'space-between', borderTop:'1px solid rgba(255,255,255,0.2)', paddingTop:'15px', marginTop:'10px'}}>
                            <div><span style={{fontSize:'10px'}}>INSURANCE BALANCE</span><div style={{fontSize:'22px', fontWeight:'bold'}}>£{totals.insuranceDue.toFixed(2)}</div></div>
                            <div style={{textAlign:'right'}}><span style={{fontSize:'10px'}}>PROFIT</span><div style={{fontSize:'22px', fontWeight:'bold'}}>£{totals.netProfit.toFixed(2)}</div></div>
                        </div>
                    </div>
                </>
            )}

            {page === 'INSURANCE' && (
                <div style={s.card}>
                    <span style={s.label}>Bundle Documents (Vault)</span>
                    <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:'10px', marginTop:'10px'}}>
                        <button style={{...s.secondaryBtn, background: repair.dealFile?.auth ? theme.success : theme.border}} onClick={() => document.getElementById('auth').click()}>Authority</button>
                        <input id="auth" type="file" style={{display:'none'}} onChange={(e) => handleFileUpload(e, 'deals', 'auth')} />
                        <button style={{...s.secondaryBtn, background: repair.dealFile?.sat ? theme.success : theme.border}} onClick={() => document.getElementById('sat').click()}>Sat Note</button>
                        <input id="sat" type="file" style={{display:'none'}} onChange={(e) => handleFileUpload(e, 'deals', 'sat')} />
                        <button style={{...s.secondaryBtn, background: repair.dealFile?.tc ? theme.success : theme.border}} onClick={() => document.getElementById('tc').click()}>T&Cs</button>
                        <input id="tc" type="file" style={{display:'none'}} onChange={(e) => handleFileUpload(e, 'deals', 'tc')} />
                        <button style={{...s.secondaryBtn, background: repair.dealFile?.inv ? theme.success : theme.border}} onClick={() => document.getElementById('inv').click()}>Supplier Invoice</button>
                        <input id="inv" type="file" style={{display:'none'}} onChange={(e) => handleFileUpload(e, 'deals', 'inv')} />
                    </div>
                </div>
            )}

            {page === 'SETTINGS' && (
                <div style={s.card}>
                    <span style={s.label}>Letterhead Logo</span>
                    <input type="file" onChange={(e) => handleFileUpload(e, 'branding', 'logoUrl')} />
                    <input style={s.input} placeholder="Parts Markup %" value={settings.markup} onChange={e => setSettings({...settings, markup: e.target.value})} />
                    <input style={s.input} placeholder="PayPal QR URL" value={settings.paypalQr} onChange={e => setSettings({...settings, paypalQr: e.target.value})} />
                    <button style={s.btnGreen} onClick={async () => { await setDoc(doc(db, 'settings', 'global'), settings); alert("Settings Saved"); }}>Save Settings</button>
                </div>
            )}

            <div className="no-print" style={{ position: 'fixed', bottom: 0, left: 0, right: 0, background: theme.card, padding: '15px', display: 'flex', gap: '10px', borderTop: `1px solid ${theme.border}`, zIndex: 1000 }}>
                <button onClick={async () => { await setDoc(doc(db, 'estimates', vehicle.reg || Date.now().toString()), { customer, vehicle, insurance, repair, totals, createdAt: serverTimestamp() }); alert("Synced"); }} style={{ ...s.btnGreen, flex: 2 }}>SAVE JOB</button>
                <button onClick={() => window.print()} style={{...s.secondaryBtn, flex: 1}}>🖨️ PRINT</button>
            </div>

            {/* PRINT VIEW */}
            <div className="print-only" style={{ display: 'none', color: 'black', fontFamily: 'Arial' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '3px solid #f97316', paddingBottom: '10px' }}>
                    <div>{settings.logoUrl && <img src={settings.logoUrl} style={{height:'60px'}} />}<h1>{settings.coName}</h1></div>
                    <div style={{textAlign:'right'}}><h2 style={{color:'#f97316'}}>SPLIT INVOICE</h2><p>Date: {new Date().toLocaleDateString()}<br/>Reg: {vehicle.reg}</p></div>
                </div>
                <table style={{width:'100%', marginTop:'30px', borderCollapse:'collapse'}}>
                    <tr style={{background:'#eee'}}><th style={{padding:'10px', textAlign:'left'}}>Description</th><th style={{padding:'10px', textAlign:'right'}}>Total</th></tr>
                    {repair.items.map((it, i) => (<tr key={i}><td style={{padding:'10px', borderBottom:'1px solid #ddd'}}>{it.desc}</td><td style={{textAlign:'right', padding:'10px', borderBottom:'1px solid #ddd'}}>£{(parseFloat(it.cost)*(1+(settings.markup/100))).toFixed(2)}</td></tr>))}
                </table>
                <div style={{textAlign:'right', marginTop:'20px'}}>
                    <h2>TOTAL DUE: £{totals.total.toFixed(2)}</h2>
                    <div style={{background:'#fff3e0', padding:'15px', marginTop:'15px', border:'2px solid #f97316', textAlign:'left'}}>
                        <p><strong>CUSTOMER PORTION (EXCESS): £{totals.customerDue.toFixed(2)}</strong></p>
                        <p><strong>INSURANCE BALANCE DUE: £{totals.insuranceDue.toFixed(2)}</strong></p>
                    </div>
                </div>
                <div style={{marginTop:'40px', display:'flex', justifyContent:'space-between'}}>
                    <p style={{fontSize:'12px'}}>Bank: {settings.bank}</p>
                    {settings.paypalQr && <div style={{textAlign:'center'}}><img src={settings.paypalQr} style={{height:'80px'}} /><br/><span style={{fontSize:'8px'}}>SCAN TO PAY</span></div>}
                </div>
            </div>
            <style>{`@media print { .no-print { display: none !important; } .print-only { display: block !important; } body { background: white !important; } }`}</style>
        </div>
    );
};

const App = () => {
    const [u, sU] = useState(null);
    useEffect(() => { onAuthStateChanged(auth, u => u ? sU(u.uid) : signInAnonymously(auth)); }, []);
    return u ? <EstimateApp userId={u} /> : null;
};
export default App;
