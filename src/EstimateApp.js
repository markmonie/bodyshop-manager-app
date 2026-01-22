import React, { useState, useEffect, useRef, useMemo } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, collection, addDoc, updateDoc, doc, onSnapshot, query, orderBy, serverTimestamp, where, getDocs, setDoc, getDoc, deleteDoc } from 'firebase/firestore';
import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import axios from 'axios';

// --- TRIPLE MMM CONFIG ---
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
const inputStyle = { width: '100%', padding: '8px', marginBottom: '8px', borderRadius: '4px', border: '1px solid #ccc', fontSize: '1em' };
const headerStyle = { borderBottom: '2px solid #cc0000', paddingBottom: '5px', marginBottom: '10px', color: '#cc0000', fontSize: '0.9em' };
const rowStyle = { display: 'flex', justifyContent: 'space-between', padding: '2px 0' };
const primaryBtn = { padding: '12px 24px', background: '#16a34a', color: 'white', border: 'none', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer', transition: '0.2s' };
const successBtn = { padding: '12px 24px', background: '#15803d', color: 'white', border: '2px solid #22c55e', borderRadius: '6px', fontWeight: 'bold', cursor: 'default', boxShadow: '0 0 10px #22c55e' };
const secondaryBtn = { padding: '12px 24px', background: '#1e3a8a', color: 'white', border: 'none', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer' };
const vinBtnStyle = { padding: '5px 10px', fontSize: '0.8em', background: '#3b82f6', color: 'white', textDecoration: 'none', borderRadius: '4px', marginRight: '5px', display:'inline-block', marginBottom:'5px' };

const EstimateApp = ({ userId }) => {
    // Modes
    const [mode, setMode] = useState('ESTIMATE');
    const [invoiceNum, setInvoiceNum] = useState('');
    const [invoiceDate, setInvoiceDate] = useState('');
    const [invoiceType, setInvoiceType] = useState('MAIN');

    // Settings
    const [settings, setSettings] = useState({
        laborRate: '50',
        markup: '20',
        companyName: 'TRIPLE MMM',
        address: '20A New Street, Stonehouse, ML9 3LT',
        phone: '07501 728319',
        email: 'markmonie72@gmail.com',
        dvlaKey: ''
    });

    // Inputs
    const [name, setName] = useState('');
    const [address, setAddress] = useState('');
    const [phone, setPhone] = useState('');
    const [email, setEmail] = useState('');
    const [claimNum, setClaimNum] = useState('');
    const [networkCode, setNetworkCode] = useState('');
    const [insuranceCo, setInsuranceCo] = useState('');
    const [insuranceAddr, setInsuranceAddr] = useState('');
    
    // Vehicle & Booking
    const [reg, setReg] = useState('');
    const [mileage, setMileage] = useState('');
    const [makeModel, setMakeModel] = useState('');
    const [vin, setVin] = useState(''); 
    const [paintCode, setPaintCode] = useState('');
    const [bookingDate, setBookingDate] = useState(''); 
    const [bookingTime, setBookingTime] = useState('09:00'); 
    const [foundHistory, setFoundHistory] = useState(false);

    // Items
    const [itemDesc, setItemDesc] = useState('');
    const [itemCostPrice, setItemCostPrice] = useState(''); 
    const [items, setItems] = useState([]);
    
    // Photos & Internal
    const [photos, setPhotos] = useState([]);
    const [uploading, setUploading] = useState(false);
    const [paintAllocated, setPaintAllocated] = useState(''); 
    const [expDesc, setExpDesc] = useState('');
    const [expAmount, setExpAmount] = useState('');
    const [expCategory, setExpCategory] = useState('Stock');

    // Financials
    const [laborHours, setLaborHours] = useState('');
    const [laborRate, setLaborRate] = useState('50');
    const [vatRate, setVatRate] = useState('0');
    const [excess, setExcess] = useState('');
    
    // System
    const [savedEstimates, setSavedEstimates] = useState([]);
    const [generalExpenses, setGeneralExpenses] = useState([]);
    const [saveStatus, setSaveStatus] = useState('IDLE');
    const [logoError, setLogoError] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');

    const canvasRef = useRef(null);
    const [isDrawing, setIsDrawing] = useState(false);

    // --- NEW: DEAL FILE STATE ---
    const [currentJobId, setCurrentJobId] = useState(null); 
    const [methodsRequired, setMethodsRequired] = useState(false);

    // --- CALCULATE ACTIVE JOB ---
    const activeJob = useMemo(() => {
        return savedEstimates.find(j => j.id === currentJobId);
    }, [savedEstimates, currentJobId]);

    // LOAD SETTINGS
    useEffect(() => {
        getDoc(doc(db, 'settings', 'global')).then(snap => {
            if(snap.exists()) {
                const s = snap.data();
                setSettings(s);
                setLaborRate(s.laborRate || '50');
                setVatRate(s.vatRate || '0');
            }
        });
        const qEst = query(collection(db, 'estimates'), orderBy('createdAt', 'desc'));
        const unsubEst = onSnapshot(qEst, (snap) => setSavedEstimates(snap.docs.map(d => ({id: d.id, ...d.data()}))));
        const qExp = query(collection(db, 'expenses'), orderBy('date', 'desc'));
        const unsubExp = onSnapshot(qExp, (snap) => setGeneralExpenses(snap.docs.map(d => ({id: d.id, ...d.data()}))));
        return () => { unsubEst(); unsubExp(); };
    }, []);

    // AUTO-LOAD & SAVE DRAFT
    useEffect(() => {
        const savedData = localStorage.getItem('triple_mmm_draft');
        if (savedData) {
            const draft = JSON.parse(savedData);
            setName(draft.name || ''); setReg(draft.reg || ''); setItems(draft.items || []);
            setLaborRate(draft.laborRate || settings.laborRate); setClaimNum(draft.claimNum || '');
            setNetworkCode(draft.networkCode || ''); setPhotos(draft.photos || []);
            setPaintAllocated(draft.paintAllocated || '');
            setBookingDate(draft.bookingDate || ''); setBookingTime(draft.bookingTime || '09:00');
            setVin(draft.vin || ''); setPaintCode(draft.paintCode || '');
            setExcess(draft.excess || ''); setInsuranceCo(draft.insuranceCo || ''); setInsuranceAddr(draft.insuranceAddr || '');
        }
    }, [settings]);

    useEffect(() => {
        if(mode === 'SETTINGS' || mode === 'DASHBOARD' || mode === 'DEAL_FILE') return;
        const draft = { name, reg, items, laborRate, claimNum, networkCode, photos, paintAllocated, bookingDate, bookingTime, vin, paintCode, excess, insuranceCo, insuranceAddr, mode };
        localStorage.setItem('triple_mmm_draft', JSON.stringify(draft));
    }, [name, reg, items, laborRate, claimNum, networkCode, photos, paintAllocated, bookingDate, bookingTime, vin, paintCode, excess, insuranceCo, insuranceAddr, mode]);

    // --- FUNCTIONS ---
    
    // NEW: JOB LOADER
    const loadJobIntoState = (est) => {
        setCurrentJobId(est.id); 
        setName(est.customer);
        setAddress(est.address || ''); 
        setPhone(est.phone || ''); 
        setEmail(est.email || ''); 
        setReg(est.reg);
        setMileage(est.mileage || ''); 
        setMakeModel(est.makeModel || ''); 
        setVin(est.vin || ''); 
        setPaintCode(est.paintCode || ''); 
        setClaimNum(est.claimNum || ''); 
        setNetworkCode(est.networkCode || ''); 
        setInsuranceCo(est.insuranceCo || ''); 
        setInsuranceAddr(est.insuranceAddr || ''); 
        
        setItems(est.items || []); 
        setLaborHours(est.laborHours || ''); 
        setLaborRate(est.laborRate || settings.laborRate); 
        setVatRate(est.vatRate || settings.vatRate);
        setExcess(est.excess || ''); 
        setPhotos(est.photos || []); 
        setBookingDate(est.bookingDate || ''); 
        setBookingTime(est.bookingTime || '09:00'); 
        setPaintAllocated(est.paintAllocated || ''); 
        
        setInvoiceNum(est.invoiceNumber || '');
        setMethodsRequired(est.dealFile?.methodsRequired || false); 
        setMode('DEAL_FILE'); 
        window.scrollTo(0, 0);
    };

    // NEW: UPLOAD LOGIC
    const uploadDoc = async (docType, file) => {
        if (!currentJobId) return alert("Please SAVE the job first before uploading documents.");
        if (!file) return;

        const storageRef = ref(storage, `deal_docs/${currentJobId}/${docType}_${file.name}`);
        
        try {
            setSaveStatus('SAVING');
            const snap = await uploadBytes(storageRef, file);
            const url = await getDownloadURL(snap.ref);
            
            const fileData = { name: file.name, url: url, date: new Date().toLocaleDateString() };
            
            // Update Firestore with the new file link using dot notation
            await updateDoc(doc(db, 'estimates', currentJobId), {
                [`dealFile.${docType}`]: fileData
            });
            
            setSaveStatus('IDLE');
            alert("Document Uploaded!");
        } catch (e) {
            console.error(e);
            alert("Upload failed: " + e.message);
            setSaveStatus('IDLE');
        }
    };

    const toggleMethods = async () => {
        if (!currentJobId) return alert("Save job first.");
        const newVal = !methodsRequired;
        setMethodsRequired(newVal);
        await updateDoc(doc(db, 'estimates', currentJobId), { 'dealFile.methodsRequired': newVal });
    };

    const addToGoogleCalendar = () => {
        if(!bookingDate) return alert("Please select a Booking Date first.");
        const start = bookingDate.replace(/-/g, '') + 'T' + bookingTime.replace(/:/g, '') + '00';
        const end = bookingDate.replace(/-/g, '') + 'T' + (parseInt(bookingTime.split(':')[0]) + 1).toString().padStart(2, '0') + bookingTime.split(':')[1] + '00';
        
        const title = encodeURIComponent(`Repair: ${name} (${reg})`);
        const details = encodeURIComponent(`Vehicle: ${makeModel}\nPhone: ${phone}\n\nWork Required:\n${items.map(i => '- ' + i.desc).join('\n')}`);
        const loc = encodeURIComponent(settings.address);
        
        const url = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&dates=${start}/${end}&details=${details}&location=${loc}`;
        window.open(url, '_blank');
    };

    // FIXED: Smart Print Logic
    const handlePrint = () => {
        if (mode === 'DEAL_FILE' || mode === 'DASHBOARD' || mode === 'SETTINGS') {
            setMode('INVOICE');
        }
        setTimeout(() => {
            window.print();
        }, 1000);
    };

    const checkHistory = async (regInput) => {
        if(regInput.length < 3) return;
        const q = query(collection(db, 'estimates'), where("reg", "==", regInput), orderBy('createdAt', 'desc'));
        try {
            const querySnapshot = await getDocs(q);
            if (!querySnapshot.empty) {
                const prev = querySnapshot.docs[0].data();
                setMakeModel(prev.makeModel || ''); 
                setName(prev.customer || '');
                setPhone(prev.phone || '');
                setEmail(prev.email || '');
                setAddress(prev.address || '');
                setVin(prev.vin || '');
                setPaintCode(prev.paintCode || '');
                if(prev.insuranceCo) setInsuranceCo(prev.insuranceCo);
                setFoundHistory(true);
            }
        } catch(e) { }
    };

    const handleRegChange = (e) => {
        const val = e.target.value.toUpperCase();
        setReg(val);
        setFoundHistory(false);
    };

    const lookupReg = async () => {
        if (!reg || reg.length < 3) return alert("Enter Registration");
        if (settings.dvlaKey) {
            try {
                const res = await axios.post(
                    'https://driver-vehicle-licensing.api.gov.uk/vehicle-enquiry/v1/vehicles',
                    { registrationNumber: reg },
                    { headers: { 'x-api-key': settings.dvlaKey } }
                );
                if (res.data) {
                    setMakeModel(`${res.data.make} ${res.data.colour}`);
                    alert("Vehicle Found!");
                }
            } catch (e) { alert("DVLA Error: " + e.message); }
        } else {
            alert("Waiting for DVLA Key... (Simulated: Vehicle Found!)");
            setMakeModel("FORD TRANSIT (Simulated)");
        }
    };

    const addItem = () => {
        if (!itemDesc) return;
        const cost = parseFloat(itemCostPrice) || 0;
        const markupPercent = parseFloat(settings.markup) || 0;
        const price = cost * (1 + (markupPercent / 100)); 
        setItems([...items, { desc: itemDesc, costPrice: cost, price: price }]);
        setItemDesc(''); setItemCostPrice('');
    };

    const removeItem = (indexToRemove) => {
        setItems(items.filter((_, index) => index !== indexToRemove));
    };

    const calculateJobFinancials = () => {
        const partsPrice = items.reduce((acc, i) => acc + i.price, 0); 
        const partsCost = items.reduce((acc, i) => acc + i.costPrice, 0); 
        const labor = (parseFloat(laborHours) || 0) * (parseFloat(laborRate) || 0);
        const paintCost = parseFloat(paintAllocated) || 0;
        const invoiceTotal = partsPrice + labor;
        const totalJobCost = partsCost + paintCost;
        const jobProfit = invoiceTotal - totalJobCost;
        const excessAmount = parseFloat(excess) || 0;
        const finalDue = invoiceTotal - excessAmount;
        return { partsPrice, partsCost, labor, paintCost, invoiceTotal, totalJobCost, jobProfit, excessAmount, finalDue };
    };

    const totals = calculateJobFinancials();

    // --- ACTIONS ---
    const saveSettings = async () => {
        await setDoc(doc(db, 'settings', 'global'), settings);
        alert("Settings Saved!");
        setMode('ESTIMATE');
        setLaborRate(settings.laborRate);
        setVatRate(settings.vatRate);
    };

    const addGeneralExpense = async () => {
        if(!expDesc || !expAmount) return;
        await addDoc(collection(db, 'expenses'), { desc: expDesc, amount: parseFloat(expAmount), category: expCategory, date: serverTimestamp() });
        setExpDesc(''); setExpAmount('');
    };
    
    const deleteJob = async (id) => {
        if(window.
