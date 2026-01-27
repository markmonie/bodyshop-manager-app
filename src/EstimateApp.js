import React, { useState, useEffect, useMemo } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, collection, onSnapshot, query, orderBy, serverTimestamp, setDoc, getDoc, doc, deleteDoc, addDoc } from 'firebase/firestore';
import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage';

const firebaseConfig = {
  apiKey: "AIzaSyDVfPvFLoL5eqQ3WQB96n08K3thdclYXRQ",
  authDomain: "triple-mmm-body-repairs.firebaseapp.com",
  projectId: "triple-mmm-body-repairs",
  storageBucket: "triple-mmm-body-repairs.firebasestorage.app",
  messagingSenderId: "110018101133",
  appId: "1:110018101133:web:63b0996c7050c4967147c4",
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);
const storage = getStorage(app);

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

const theme = { bg: '#000000', card: '#111111', est: '#f97316', work: '#fbbf24', deal: '#16a34a', set: '#2563eb', text: '#f8fafc', border: '#333' };
const s = {
    card: (color) => ({ background: theme.card, borderRadius: '12px', padding: '20px', marginBottom: '15px', border: `1px solid ${theme.border}`, borderTop: `4px solid ${color || theme.est}` }),
    input: { width: '100%', background: '#000', border: '1px solid #444', color: '#fff', padding: '12px', borderRadius: '8px', marginBottom: '10px' },
    btnG: { background: theme.deal, color: 'white', border: 'none', padding: '12px 20px', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer' },
    btnR: { background: '#ef4444', color: 'white', border: 'none', padding: '12px 20px', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer' },
    dock: { position: 'fixed', bottom: 0, left: 0, right: 0, background: '#111', padding: '15px', display: 'flex', gap: '10px', overflowX: 'auto', borderTop: '2px solid #333', zIndex: 1000 }
};

const EstimateApp = ({ userId }) => {
    const [page, setPage] = useState('HOME'); // HOME, WORKSHOP, INSURANCE, FINANCE, SETTINGS
    const [loading, setLoading] = useState(false);
    const [settings, setSettings] = useState({ coName: 'Triple MMM', address: '', phone: '', bank: '', markup: '20', labourRate: '50', dvlaKey: 'IXqv1yDD1latEPHIntk2w8MEuz9X57IE9TP9sxGc', password: '1234' });
    const [job, setJob] = useState({
        client: { name: '', phone: '', email: '', address: '' },
        insurance: { co: '', claim: '', network: '', email: '', address: '' },
        vehicle: { reg: '', make: '', vin: '', year: '', colour: '', paintCode: '' },
        repair: { items: [], panelHrs: 0, paintHrs: 0, metHrs: 0, paintMats: 0, excess: 0 },
        vault: { auth: '', sat: '', tc: '', photos: [] }
    });
    const [allJobs, setAllJobs] = useState([]);

    useEffect(() => {
        getDoc(doc(db, 'settings', 'global')).then(snap => snap.exists() && setSettings(prev => ({...prev, ...snap.data()})));
        return onSnapshot(query(collection(db, 'estimates'), orderBy('createdAt', 'desc')), (snap) => setAllJobs(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
    }, []);

    const totals = useMemo(() => {
        const partsCost = job.repair.items.reduce((a, b) => a + (parseFloat(b.cost) || 0), 0);
        const partsPrice = partsCost * (1 + (parseFloat(settings.markup) / 100));
        const labPrice = (parseFloat(job.repair.panelHrs) + parseFloat(job.repair.paintHrs) + parseFloat(job.repair.metHrs)) * settings.labourRate;
        const total = partsPrice + labPrice + parseFloat(job.repair.paintMats || 0);
        return { total, customer: parseFloat(job.repair.excess || 0), insurer: total - parseFloat(job.repair.excess || 0) };
    }, [job.repair, settings]);

    const runDVLA = async () => {
        setLoading(true);
        const proxy = `https://corsproxy.io/?${encodeURIComponent('https://driver-vehicle-licensing.api.gov.uk/vehicle-enquiry/v1/vehicles')}`;
        try {
            const res = await axios.post(proxy, { registrationNumber: job.vehicle.reg }, { headers: { 'x-api-key': settings.dvlaKey } });
            setJob({...job, vehicle: {...job.vehicle, make: res.data.make, year: res.data.yearOfManufacture, colour: res.data.colour}});
        } catch (e) { alert("Manual Entry Required"); }
        setLoading(false);
    };

    return (
        <div style={{ background: theme.bg, minHeight: '100vh', color: theme.text, padding: '20px', paddingBottom: '120px' }}>
            {/* HUB / HOME PAGE */}
            {page === 'HOME' && (
                <div>
                    <h1 style={{color:theme.est}}>MANAGEMENT HUB</h1>
                    <div style={s.card(theme.est)}>
                        <span style={{color:theme.est, fontWeight:'bold'}}>1. DATA ACQUISITION (DVLA)</span>
                        <div style={{display:'flex', gap:'10px', marginTop:'10px'}}>
                            <input style={s.input} value={job.vehicle.reg} onChange={e=>setJob({...job, vehicle:{...job.vehicle, reg:e.target.value.toUpperCase()}})} placeholder="VEHICLE REG" />
                            <button style={s.btnG} onClick={runDVLA}>{loading ? '...' : 'PULL DATA'}</button>
                        </div>
                        <input style={s.input} placeholder="CHASSIS / VIN (MANUAL)" value={job.vehicle.vin} onChange={e=>setJob({...job, vehicle:{...job.vehicle, vin:e.target.value}})} />
                    </div>
                    <div style={s.card(theme.est)}>
                        <span style={{color:theme.est, fontWeight:'bold'}}>2. CLIENT & INSURANCE DATA</span>
                        <input style={s.input} placeholder="Client Name" value={job.client.name} onChange={e=>setJob({...job, client:{...job.client, name:e.target.value}})} />
                        <input style={s.input} placeholder="Insurance Co" value={job.insurance.co} onChange={e=>setJob({...job, insurance:{...job.insurance, co:e.target.value}})} />
                        <input style={s.input} placeholder="Claim Number" value={job.insurance.claim} onChange={e=>setJob({...job, insurance:{...job.insurance, claim:e.target.value}})} />
                    </div>
                </div>
            )}

            {/* WORKSHOP PAGE */}
            {page === 'WORKSHOP' && (
                <div>
                    <h1 style={{color:theme.work}}>WORKSHOP JOBSHEET</h1>
                    <div style={s.card(theme.work)}>
                        <h3>{job.vehicle.reg} | {job.vehicle.make}</h3>
                        <p>VIN: {job.vehicle.vin}</p>
                        <hr style={{borderColor:'#333'}}/>
                        <a href="https://www.partslink24.com" target="_blank" style={{color:theme.work, fontSize:'12px'}}>Link to Manufacturer Parts Database →</a>
                    </div>
                </div>
            )}

            {/* DOCK NAVIGATION */}
            <div className="no-print" style={s.dock}>
                <button style={{...s.btnG, background:theme.est}} onClick={()=>setPage('HOME')}>HUB</button>
                <button style={{...s.btnG, background:theme.work}} onClick={()=>setPage('WORKSHOP')}>WORKSHOP</button>
                <button style={{...s.btnG, background:theme.deal}} onClick={()=>setPage('INSURANCE')}>INSURANCE</button>
                <button style={{...s.btnG, background:theme.set}} onClick={()=>setPage('FINANCE')}>FINANCE</button>
                <button style={{...s.btnG, background:'#444'}} onClick={()=>setPage('SETTINGS')}>SETTINGS</button>
                <button style={{...s.btnG, background:theme.deal}} onClick={async () => {
                    await setDoc(doc(db, 'estimates', job.vehicle.reg || Date.now().toString()), { ...job, totals, createdAt: serverTimestamp() });
                    alert("Triple MMM Cloud Synchronized");
                }}>SYNC ALL</button>
            </div>

            <style>{`
                @media print { .no-print { display: none !important; } .print-only { display: block !important; } body { background: white !important; } }
            `}</style>
        </div>
    );
};

const App = () => {
    const [u, sU] = useState(null);
    useEffect(() => { onAuthStateChanged(auth, u => u ? sU(u.uid) : signInAnonymously(auth)); }, []);
    return u ? <EstimateApp userId={u} /> : null;
};
export default App;
