import React, { useState, useEffect, useRef, useMemo } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, collection, addDoc, updateDoc, doc, onSnapshot, query, orderBy, serverTimestamp, where, getDocs, setDoc, getDoc, deleteDoc } from 'firebase/firestore';
import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage';

// ==========================================
// 🔑 DVLA API KEY (Hardcoded & Verified)
// ==========================================
const HARDCODED_DVLA_KEY = "IXqv1yDD1latEPHIntk2w8MEuz9X57IE9TP9sxGc"; 
// ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^

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

// --- STYLES ---
const theme = {
    primary: '#ea580c', green: '#16a34a', red: '#dc2626', light: '#fff7ed', dark: '#9a3412',
    border: '#fdba74', grey: '#f8fafc', text: '#334155', disabled: '#9ca3af'
};
const inputStyle = { width: '100%', padding: '10px', marginBottom: '10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '1em', boxSizing: 'border-box' };
const headerStyle = { borderBottom: `2px solid ${theme.primary}`, paddingBottom: '5px', marginBottom: '15px', color: theme.primary, fontSize: '0.9em', fontWeight: 'bold', letterSpacing: '1px' };
const rowStyle = { display: 'flex', justifyContent: 'space-between', padding: '4px 0' };
const btnBase = { padding: '12px 20px', border: 'none', borderRadius: '50px', fontWeight: 'bold', cursor: 'pointer', whiteSpace: 'nowrap', boxShadow: '0 2px 5px rgba(0,0,0,0.1)', fontSize: '0.9em' };
const primaryBtn = { ...btnBase, background: theme.primary, color: 'white' }; 
const greenBtn = { ...btnBase, background: theme.green, color: 'white' }; 
const secondaryBtn = { ...btnBase, background: '#334155', color: 'white' };
const dangerBtn = { ...btnBase, background: theme.red, color: 'white', padding: '8px 15px' }; 
const successBtn = { ...greenBtn, border: '2px solid #14532d' };

const EstimateApp = ({ userId }) => {
    // --- STATE ---
    const [mode, setMode] = useState('ESTIMATE');
    const [invoiceNum, setInvoiceNum] = useState('');
    const [invoiceDate, setInvoiceDate] = useState('');
    const [invoiceType, setInvoiceType] = useState('MAIN');
    
    // Settings
    const [settings, setSettings] = useState({
        laborRate: '50', markup: '20', companyName: 'TRIPLE MMM',
        address: '20A New Street, Stonehouse, ML9 3LT', phone: '07501 728319', email: 'markmonie72@gmail.com',
        dvlaKey: HARDCODED_DVLA_KEY, terms: 'Payment Terms: 30 Days. Title of goods remains with Triple MMM until paid in full.'
    });
    
    // Data Fields
    const [name, setName] = useState(''); const [address, setAddress] = useState(''); const [phone, setPhone] = useState(''); const [email, setEmail] = useState('');
    const [claimNum, setClaimNum] = useState(''); const [networkCode, setNetworkCode] = useState(''); const [insuranceCo, setInsuranceCo] = useState(''); const [insuranceAddr, setInsuranceAddr] = useState(''); const [insuranceEmail, setInsuranceEmail] = useState('');
    const [reg, setReg] = useState(''); const [mileage, setMileage] = useState(''); const [makeModel, setMakeModel] = useState(''); const [vin, setVin] = useState(''); const [paintCode, setPaintCode] = useState('');
    const [vehicleInfo, setVehicleInfo] = useState(null); const [bookingDate, setBookingDate] = useState(''); const [bookingTime, setBookingTime] = useState('09:00'); 
    const [foundHistory, setFoundHistory] = useState(false); const [isLookingUp, setIsLookingUp] = useState(false);
    
    const [itemDesc, setItemDesc] = useState(''); const [itemCostPrice, setItemCostPrice] = useState(''); const [items, setItems] = useState([]);
    const [photos, setPhotos] = useState([]); const [uploading, setUploading] = useState(false); const [paintAllocated, setPaintAllocated] = useState(''); 
    const [expDesc, setExpDesc] = useState(''); const [expAmount, setExpAmount] = useState(''); const [expCategory, setExpCategory] = useState('Stock');
    const [laborHours, setLaborHours] = useState(''); const [laborRate, setLaborRate] = useState('50'); const [vatRate, setVatRate] = useState('0'); const [excess, setExcess] = useState('');
    
    const [savedEstimates, setSavedEstimates] = useState([]); const [generalExpenses, setGeneralExpenses] = useState([]);
    const [saveStatus, setSaveStatus] = useState('IDLE'); const [logoError, setLogoError] = useState(false); const [searchTerm, setSearchTerm] = useState('');
    const canvasRef = useRef(null); const [isDrawing, setIsDrawing] = useState(false); const [currentJobId, setCurrentJobId] = useState(null); 
    const [methodsRequired, setMethodsRequired] = useState(false); const [axiosReady, setAxiosReady] = useState(false);

    const activeJob = useMemo(() => savedEstimates.find(j => j.id === currentJobId), [savedEstimates, currentJobId]);
    const isDealFileReady = useMemo(() => activeJob?.dealFile?.auth && activeJob?.dealFile?.terms && activeJob?.dealFile?.satisfaction, [activeJob]);

    // --- EFFECT: Inject Real Axios (Fixes "Network Error") ---
    useEffect(() => {
        const script = document.createElement('script');
        script.src = "https://cdn.jsdelivr.net/npm/axios/dist/axios.min.js";
        script.async = true;
        script.onload = () => { console.log("Axios Engine Ready"); setAxiosReady(true); };
        document.body.appendChild(script);
        return () => { try { document.body.removeChild(script); } catch(e){} }
    }, []);

    // --- EFFECT: Firebase ---
    useEffect(() => {
        getDoc(doc(db, 'settings', 'global')).then(snap => { if(snap.exists()) { const s = snap.data(); setSettings(prev => ({...prev, ...s, dvlaKey: HARDCODED_DVLA_KEY})); setLaborRate(s.laborRate || '50'); }});
        const qEst = query(collection(db, 'estimates'), orderBy('createdAt', 'desc'));
        const unsubEst = onSnapshot(qEst, (snap) => setSavedEstimates(snap.docs.map(d => ({id: d.id, ...d.data()}))));
        const qExp = query(collection(db, 'expenses'), orderBy('date', 'desc'));
        const unsubExp = onSnapshot(qExp, (snap) => setGeneralExpenses(snap.docs.map(d => ({id: d.id, ...d.data()}))));
        return () => { unsubEst(); unsubExp(); };
    }, []);

    useEffect(() => {
        if(mode === 'SETTINGS' || mode === 'DASHBOARD' || mode === 'DEAL_FILE') return;
        const draft = { name, reg, items, laborRate, claimNum, networkCode, photos, paintAllocated, bookingDate, bookingTime, vin, paintCode, excess, insuranceCo, insuranceAddr, insuranceEmail, mode };
        localStorage.setItem('triple_mmm_draft', JSON.stringify(draft));
    }, [name, reg, items, laborRate, claimNum, networkCode, photos, paintAllocated, bookingDate, bookingTime, vin, paintCode, excess, insuranceCo, insuranceAddr, insuranceEmail, mode]);

    const loadJobIntoState = (est) => {
        setCurrentJobId(est.id); setName(est.customer); setAddress(est.address||''); setPhone(est.phone||''); setEmail(est.email||''); setReg(est.reg); setMileage(est.mileage||''); setMakeModel(est.makeModel||''); setVin(est.vin||''); setPaintCode(est.paintCode||''); setClaimNum(est.claimNum||''); setNetworkCode(est.networkCode||''); setInsuranceCo(est.insuranceCo||''); setInsuranceAddr(est.insuranceAddr||''); setInsuranceEmail(est.insuranceEmail||''); setItems(est.items||[]); setLaborHours(est.laborHours||''); setLaborRate(est.laborRate||settings.laborRate); setVatRate(est.vatRate||settings.vatRate); setExcess(est.excess||''); setPhotos(est.photos||[]); setBookingDate(est.bookingDate||''); setBookingTime(est.bookingTime||'09:00'); setPaintAllocated(est.paintAllocated||''); setInvoiceNum(est.invoiceNumber||''); setVehicleInfo(est.vehicleInfo||null); setMethodsRequired(est.dealFile?.methodsRequired||false); setMode('DEAL_FILE'); window.scrollTo(0, 0);
    };

    // --- HELPER FUNCTIONS (Restored) ---
    const handleRegChange = (e) => { const val = e.target.value.toUpperCase(); setReg(val); setFoundHistory(false); };
    
    const checkHistory = async (regInput) => {
        if(regInput.length < 3) return;
        const q = query(collection(db, 'estimates'), where("reg", "==", regInput), orderBy('createdAt', 'desc'));
        try { const snap = await getDocs(q); if (!snap.empty) { const prev = snap.docs[0].data(); setMakeModel(prev.makeModel||''); setName(prev.customer||''); setPhone(prev.phone||''); setEmail(prev.email||''); setAddress(prev.address||''); setVin(prev.vin||''); setPaintCode(prev.paintCode||''); setVehicleInfo(prev.vehicleInfo||null); if(prev.insuranceCo) setInsuranceCo(prev.insuranceCo); if(prev.insuranceEmail) setInsuranceEmail(prev.insuranceEmail); setFoundHistory(true); } } catch(e) {}
    };

    const addToGoogleCalendar = () => {
        if(!bookingDate) return alert("Select Booking Date.");
        const start = bookingDate.replace(/-/g, '') + 'T' + bookingTime.replace(/:/g, '') + '00';
        const end = bookingDate.replace(/-/g, '') + 'T' + (parseInt(bookingTime.split(':')[0]) + 1).toString().padStart(2, '0') + bookingTime.split(':')[1] + '00';
        window.open(`https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(`Repair: ${name} (${reg})`)}&dates=${start}/${end}&details=${encodeURIComponent(makeModel)}&location=${encodeURIComponent(settings.address)}`, '_blank');
    };

    const handlePrint = () => { if (mode === 'DEAL_FILE' || mode === 'DASHBOARD' || mode === 'SETTINGS') setMode('INVOICE'); setTimeout(() => window.print(), 1000); };
    
    const uploadDoc = async (docType, file) => {
        if (!currentJobId) return alert("Save job first.");
        const storageRef = ref(storage, `deal_docs/${currentJobId}/${docType}_${file.name}`);
        try { setSaveStatus('SAVING'); const snap = await uploadBytes(storageRef, file); const url = await getDownloadURL(snap.ref); await updateDoc(doc(db, 'estimates', currentJobId), { [`dealFile.${docType}`]: { name: file.name, url: url, date: new Date().toLocaleDateString() } }); setSaveStatus('IDLE'); alert("Uploaded!"); } catch (e) { alert("Upload failed: " + e.message); setSaveStatus('IDLE'); }
    };

    const saveSettings = async () => { await setDoc(doc(db, 'settings', 'global'), settings); alert("Settings Saved!"); setMode('ESTIMATE'); };
    const addGeneralExpense = async () => { if(!expDesc || !expAmount) return; await addDoc(collection(db, 'expenses'), { desc: expDesc, amount: parseFloat(expAmount), category: expCategory, date: serverTimestamp() }); setExpDesc(''); setExpAmount(''); };
    const downloadAccountingCSV = () => { let csv = "Date,Type,Invoice,Customer,Reg,Total,Status\n"; savedEstimates.filter(est => est.type && est.type.includes('INVOICE')).forEach(inv => { csv += `${new Date(inv.createdAt?.seconds * 1000).toLocaleDateString()},${inv.type},${inv.invoiceNumber},${inv.customer},${inv.reg},${inv.totals?.finalDue.toFixed(2)},${inv.status}\n`; }); const link = document.createElement("a"); link.href = encodeURI("data:text/csv;charset=utf-8," + csv); link.download = "TripleMMM_Sales.csv"; link.click(); };
    const downloadExpensesCSV = () => { let csv = "Date,Category,Description,Amount\n"; generalExpenses.forEach(ex => { csv += `${new Date(ex.date?.seconds * 1000).toLocaleDateString()},${ex.category},${ex.desc},${ex.amount.toFixed(2)}\n`; }); const link = document.createElement("a"); link.href = encodeURI("data:text/csv;charset=utf-8," + csv); link.download = "TripleMMM_Expenses.csv"; link.click(); };

    // --- DVLA LOOKUP (Smart Fail-Safe) ---
    const lookupReg = async () => {
        if (!reg || reg.length < 3) return alert("Enter Reg");
        if (!axiosReady) return alert("System initialising... wait 2 seconds.");
        setIsLookingUp(true);
        
        // Proxy URL to bypass CORS
        const proxyUrl = 'https://corsproxy.io/?' + encodeURIComponent('https://driver-vehicle-licensing.api.gov.uk/vehicle-enquiry/v1/vehicles');
        
        try {
            // Using REAL Axios via window object
            const response = await window.axios.post(proxyUrl, { registrationNumber: reg }, {
                headers: { 'x-api-key': HARDCODED_DVLA_KEY }
            });

            const data = response.data;
            setMakeModel(`${data.make} ${data.colour}`);
            setVehicleInfo(data); 
            if(data.vin)
