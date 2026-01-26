import React, { useState, useEffect, useMemo } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, collection, addDoc, updateDoc, doc, onSnapshot, query, orderBy, serverTimestamp, setDoc, getDoc, deleteDoc } from 'firebase/firestore';
import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage';

// --- FIREBASE CONFIG ---
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

// --- STABLE DVLA ENGINE ---
const axios = {
    post: async (url, data, config) => {
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Accept': 'application/json', ...config.headers },
            body: JSON.stringify(data)
        });
        if (!response.ok) throw new Error(`DVLA Error: ${response.status}`);
        return { data: await response.json() };
    }
};

const theme = { bg: '#0f172a', card: '#1e293b', accent: '#f97316', text: '#f8fafc', textDim: '#94a3b8', success: '#16a34a', danger: '#ef4444', border: '#334155' };
const s = {
    card: { background: theme.card, borderRadius: '16px', padding: '20px', marginBottom: '20px', border: `1px solid ${theme.border}` },
    input: { width: '100%', background: '#0f172a', border: `1px solid ${theme.border}`, color: theme.text, padding: '12px', borderRadius: '8px', marginBottom: '10px', outline: 'none' },
    label: { color: theme.accent, fontSize: '11px', fontWeight: 'bold', textTransform: 'uppercase', marginBottom: '4px', display: 'block' },
    btn: { background: theme.accent, color: 'white', border: 'none', padding: '12px 20px', borderRadius: '10px', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' },
    btnGreen: { background: theme.success, color: 'white', border: 'none', padding: '10px 15px', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer' },
    navBtn: { background: 'none', border: 'none', color: theme.textDim, padding: '10px', cursor: 'pointer', fontWeight: 'bold', fontSize: '12px' },
    activeNav: { color: theme.accent, borderBottom: `2px solid ${theme.accent}` }
};

const EstimateApp = ({ userId }) => {
    const [page, setPage] = useState('WORKSHOP'); 
    const [loading, setLoading] = useState(false);
    const [currentJobId, setCurrentJobId] = useState(null);

    const [settings, setSettings] = useState({
        coName: 'Triple MMM Body Repairs', address: '20A New Street, Stonehouse, ML9 3LT', phone: '07501 728319',
        bank: '80-22-60 | 06163462', vatRate: '0', markup: '20', labourRate: '50', logoUrl: '', dvlaKey: 'IXqv1yDD1latEPHIntk2w8MEuz9X57IE9TP9sxGc'
    });

    const [customer, setCustomer] = useState({ name: '', phone: '', email: '', address: '' });
    const [vehicle, setVehicle] = useState({ reg: '', makeModel: '', vin: '', paint: '', year: '', fuel: '' });
    const [insurance, setInsurance] = useState({ co: '', claim: '', network: '', address: '' });
    const [repair, setRepair] = useState({ items: [], labourHours: '', paintMaterials: '', excess: '0', photos: [], dealFile: { authUrl: '', satUrl: '', tcUrl: '', invoiceUrl: '' } });
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
        return { 
            sub, vat, total, 
            customerDue: excess, 
            insuranceDue: total - excess,
            netProfit: total - (pCost + paint), 
            labourPrice: labour, paintPrice: paint, pPrice 
        };
    }, [repair, settings]);

    const handleFileUpload = async (e, field) => {
        const file = e.target.files[0]; if (!file) return;
        const r = ref(storage, `deal-files/${Date.now()}_${file.name}`);
        await uploadBytes(r, file);
        const url = await getDownloadURL(r);
        setRepair(prev => ({ ...prev, dealFile: { ...prev.dealFile, [field]: url } }));
    };

    const lookupReg = async () => {
        if (!vehicle.reg) return;
        setLoading(true);
        const proxy = `https://corsproxy.io/?${encodeURIComponent('https://driver-vehicle-licensing.api.gov.uk/vehicle-enquiry/v1/vehicles')}`;
        try {
            const res = await axios.post(proxy, { registrationNumber: vehicle.reg }, { headers: { 'x-api-key': settings.dvlaKey } });
            setVehicle(v => ({ ...v, makeModel: `${res.data.make} ${res.data.colour}`, year: res.data.yearOfManufacture, fuel: res.data.fuelType }));
        } catch (e) { alert("DVLA Blocked. Manual Entry Enabled."); }
        setLoading(false);
    };

    const addItem = () => {
        const d = document.getElementById('partDesc'), c = document.getElementById('partCost');
        if(!d.value || !c.value) return;
        setRepair({...repair, items: [...repair.items, { desc: d.value, cost: c.value }]});
        d.value = ''; c.value = '';
    };

    return (
        <div style={{ background: theme.bg, minHeight: '100vh', color: theme.text, padding: '20px', paddingBottom: '100px' }}>
            <div style={{ display: 'flex', gap: '10px', borderBottom: `1px solid ${theme.border}`, marginBottom: '20px', paddingBottom: '5px' }}>
                <button onClick={() => setPage('WORKSHOP')} style={page === 'WORKSHOP' ? {...s.navBtn, ...s.activeNav} : s.navBtn}>WORKSHOP</button>
                <button onClick={() => setPage('INSURANCE')} style={page === 'INSURANCE' ? {...s.navBtn, ...s.activeNav} : s.navBtn}>INSURANCE PACK</button>
                <button onClick={() => setPage('SETTINGS')} style={page === 'SETTINGS' ? {...s.navBtn, ...s.activeNav} : s.navBtn}>SETTINGS</button>
            </div>

            {page === 'WORKSHOP' && (
                <>
                    <div style={s.card}>
                        <span style={s.label}>Vehicle & Chassis</span>
                        <div style={{display: 'flex', gap: '10px', marginBottom: '10px'}}>
                            <input style={{...s.input, fontSize: '20px', fontWeight: 'bold', flex: 1, marginBottom: 0}} value={vehicle.reg} onChange={e => setVehicle({...vehicle, reg: e.target.value.toUpperCase()})} placeholder="REG" />
                            <button onClick={lookupReg} style={{...s.btn, background: theme.success}}>{loading ? '...' : 'FIND'}</button>
                        </div>
                        <input style={s.input} placeholder="Make & Model" value={vehicle.makeModel} readOnly />
                        <input style={s.input} placeholder="Manual Chassis Number" value={vehicle.vin} onChange={e => setVehicle({...vehicle, vin: e.target.value})} />
                    </div>

                    <div style={s.card}>
                        <span style={s.label}>Labour, Paint & Excess</span>
                        <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px'}}>
                            <input style={s.input} type="number" placeholder="Labour Hours" value={repair.labourHours} onChange={e => setRepair({...repair, labourHours: e.target.value})} />
                            <input style={s.input} type="number" placeholder="Paint & Mats £" value={repair.paintMaterials} onChange={e => setRepair({...repair, paintMaterials: e.target.value})} />
                        </div>
                        <input style={{...s.input, color: theme.danger, fontWeight: 'bold'}} type="number" placeholder="Customer Excess £" value={repair.excess} onChange={e => setRepair({...repair, excess: e.target.value})} />
                    </div>

                    <div style={{...s.card, background: theme.accent, padding: '25px'}}>
                        <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px'}}>
                            <div>
                                <span style={{fontSize: '10px', opacity: 0.8}}>INSURANCE BALANCE</span>
                                <div style={{fontSize: '24px', fontWeight: 'bold'}}>£{totals.insuranceDue.toFixed(2)}</div>
                            </div>
                            <div style={{textAlign: 'right'}}>
                                <span style={{fontSize: '10px', opacity: 0.8}}>CUSTOMER EXCESS</span>
                                <div style={{fontSize: '24px', fontWeight: 'bold'}}>£{totals.customerDue.toFixed(2)}</div>
                            </div>
                        </div>
                    </div>
                </>
            )}

            {page === 'INSURANCE' && (
                <div style={s.card}>
                    <span style={s.label}>Claim Details</span>
                    <input style={s.input} placeholder="Ref / Claim Number" value={insurance.claim} onChange={e => setInsurance({...insurance, claim: e.target.value})} />
                    <input style={s.input} placeholder="Network ID" value={insurance.network} onChange={e => setInsurance({...insurance, network: e.target.value})} />
                    
                    <span style={s.label}>Deal File Vault (Upload)</span>
                    <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginTop: '10px'}}>
                        <button style={{...s.secondaryBtn, background: repair.dealFile?.authUrl ? theme.success : theme.border}} onClick={() => document.getElementById('authIn').click()}>Authority</button>
                        <input id="authIn" type="file" style={{display:'none'}} onChange={(e) => handleFileUpload(e, 'authUrl')} />
                        
                        <button style={{...s.secondaryBtn, background: repair.dealFile?.satUrl ? theme.success : theme.border}} onClick={() => document.getElementById('satIn').click()}>Sat Note</button>
                        <input id="satIn" type="file" style={{display:'none'}} onChange={(e) => handleFileUpload(e, 'satUrl')} />
                        
                        <button style={{...s.secondaryBtn, background: repair.dealFile?.tcUrl ? theme.success : theme.border}} onClick={() => document.getElementById('tcIn').click()}>Signed T&Cs</button>
                        <input id="tcIn" type="file" style={{display:'none'}} onChange={(e) => handleFileUpload(e, 'tcUrl')} />
                        
                        <button style={{...s.secondaryBtn, background: repair.dealFile?.invoiceUrl ? theme.success : theme.border}} onClick={() => document.getElementById('invIn').click()}>Supplier Invoice</button>
                        <input id="invIn" type="file" style={{display:'none'}} onChange={(e) => handleFileUpload(e, 'invoiceUrl')} />
                    </div>
                </div>
            )}

            <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, background: theme.card, padding: '15px', display: 'flex', gap: '10px', borderTop: `1px solid ${theme.border}`, zIndex: 1000 }}>
                <button onClick={async () => { 
                    await setDoc(doc(db, 'estimates', vehicle.reg || Date.now().toString()), { customer, vehicle, insurance, repair, totals, createdAt: serverTimestamp() }); 
                    alert("Synced to Cloud"); 
                }} style={{ ...s.btn, flex: 1, background: theme.success }}>SYNC JOB</button>
                <button onClick={() => window.print()} style={{...s.btn, background: theme.border}}>🖨️ PRINT SPLIT INVOICE</button>
            </div>
        </div>
    );
};

const App = () => {
    const [u, sU] = useState(null);
    useEffect(() => { onAuthStateChanged(auth, u => u ? sU(u.uid) : signInAnonymously(auth)); }, []);
    return u ? <EstimateApp userId={u} /> : null;
};
export default App;
