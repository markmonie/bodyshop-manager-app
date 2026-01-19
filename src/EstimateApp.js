import React, { useState, useEffect, useRef } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, collection, addDoc, updateDoc, doc, onSnapshot, query, orderBy, serverTimestamp, where, getDocs, setDoc, getDoc } from 'firebase/firestore';
import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage';

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

const EstimateApp = ({ userId }) => {
    // Modes: 'ESTIMATE', 'INVOICE', 'SATISFACTION', 'JOBCARD', 'SETTINGS'
    const [mode, setMode] = useState('ESTIMATE');
    const [invoiceNum, setInvoiceNum] = useState('');
    const [invoiceDate, setInvoiceDate] = useState('');

    // --- SETTINGS STATE ---
    const [settings, setSettings] = useState({
        laborRate: '50',
        vatRate: '0',
        companyName: 'TRIPLE MMM',
        address: '20A New Street, Stonehouse, ML9 3LT',
        phone: '07501 728319',
        email: 'markmonie72@gmail.com'
    });

    // Inputs
    const [name, setName] = useState('');
    const [address, setAddress] = useState('');
    const [phone, setPhone] = useState('');
    const [email, setEmail] = useState('');
    const [claimNum, setClaimNum] = useState('');
    const [networkCode, setNetworkCode] = useState('');
    
    const [reg, setReg] = useState('');
    const [mileage, setMileage] = useState('');
    const [makeModel, setMakeModel] = useState('');

    const [itemDesc, setItemDesc] = useState('');
    const [itemCost, setItemCost] = useState('');
    const [items, setItems] = useState([]);
    
    // Photos
    const [photos, setPhotos] = useState([]);
    const [uploading, setUploading] = useState(false);

    // Financials
    const [laborHours, setLaborHours] = useState('');
    const [laborRate, setLaborRate] = useState('50'); // Loaded from settings
    const [vatRate, setVatRate] = useState('0'); // Loaded from settings
    const [excess, setExcess] = useState('');
    
    // System
    const [savedEstimates, setSavedEstimates] = useState([]);
    const [saveStatus, setSaveStatus] = useState('IDLE');
    const [logoError, setLogoError] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');

    const canvasRef = useRef(null);
    const [isDrawing, setIsDrawing] = useState(false);

    // LOAD SETTINGS FROM CLOUD
    useEffect(() => {
        const loadSettings = async () => {
            try {
                const docRef = doc(db, 'settings', 'global');
                const docSnap = await getDoc(docRef);
                if (docSnap.exists()) {
                    const s = docSnap.data();
                    setSettings(s);
                    // Apply defaults
                    setLaborRate(s.laborRate || '50');
                    setVatRate(s.vatRate || '0');
                }
            } catch (e) { console.log("Settings not loaded yet"); }
        };
        loadSettings();
    }, []);

    // SAVE SETTINGS TO CLOUD
    const saveSettings = async () => {
        try {
            await setDoc(doc(db, 'settings', 'global'), settings);
            alert("Settings Updated!");
            setMode('ESTIMATE');
            // Apply immediately
            setLaborRate(settings.laborRate);
            setVatRate(settings.vatRate);
        } catch (e) { alert("Error saving settings: " + e.message); }
    };

    // AUTO-LOAD DRAFT
    useEffect(() => {
        const savedData = localStorage.getItem('triple_mmm_draft');
        if (savedData) {
            const draft = JSON.parse(savedData);
            setName(draft.name || '');
            setReg(draft.reg || '');
            setItems(draft.items || []);
            setLaborRate(draft.laborRate || settings.laborRate);
            setClaimNum(draft.claimNum || '');
            setNetworkCode(draft.networkCode || '');
            setPhotos(draft.photos || []);
        }
    }, [settings]);

    // AUTO-SAVE DRAFT
    useEffect(() => {
        if(mode === 'SETTINGS') return;
        const draft = { name, reg, items, laborRate, claimNum, networkCode, photos };
        localStorage.setItem('triple_mmm_draft', JSON.stringify(draft));
    }, [name, reg, items, laborRate, claimNum, networkCode, photos, mode]);

    // CLOUD SYNC
    useEffect(() => {
        const q = query(collection(db, 'estimates'), orderBy('createdAt', 'desc'));
        return onSnapshot(q, (snap) => setSavedEstimates(snap.docs.map(d => ({id: d.id, ...d.data()}))));
    }, []);

    // --- FILTERED SEARCH ---
    const filteredEstimates = savedEstimates.filter(est => {
        const search = searchTerm.toLowerCase();
        return (
            (est.customer && est.customer.toLowerCase().includes(search)) ||
            (est.reg && est.reg.toLowerCase().includes(search)) ||
            (est.invoiceNumber && est.invoiceNumber.toLowerCase().includes(search))
        );
    });

    // --- PHOTO UPLOAD ---
    const handlePhotoUpload = async (e) => {
        if (!e.target.files[0]) return;
        setUploading(true);
        const file = e.target.files[0];
        const storageRef = ref(storage, `damage_photos/${Date.now()}_${file.name}`);
        try {
            await uploadBytes(storageRef, file);
            const url = await getDownloadURL(storageRef);
            setPhotos([...photos, url]);
        } catch (error) {
            alert("Upload failed! Check Storage Rules.");
        }
        setUploading(false);
    };

    const removePhoto = (index) => {
        setPhotos(photos.filter((_, i) => i !== index));
    };

    const togglePaid = async (id, currentStatus) => {
        const newStatus = currentStatus === 'PAID' ? 'UNPAID' : 'PAID';
        await updateDoc(doc(db, 'estimates', id), { status: newStatus });
    };

    const startDrawing = ({ nativeEvent }) => {
        const { offsetX, offsetY } = getCoordinates(nativeEvent);
        const ctx = canvasRef.current.getContext('2d');
        ctx.lineWidth = 3; 
        ctx.lineCap = 'round';
        ctx.strokeStyle = '#000';
        ctx.beginPath();
        ctx.moveTo(offsetX, offsetY);
        setIsDrawing(true);
    };

    const draw = ({ nativeEvent }) => {
        if (!isDrawing) return;
        const { offsetX, offsetY } = getCoordinates(nativeEvent);
        const ctx = canvasRef.current.getContext('2d');
        ctx.lineTo(offsetX, offsetY);
        ctx.stroke();
    };

    const stopDrawing = () => {
        const ctx = canvasRef.current.getContext('2d');
        ctx.closePath();
        setIsDrawing(false);
    };

    const getCoordinates = (event) => {
        if (event.touches && event.touches[0]) {
            const rect = canvasRef.current.getBoundingClientRect();
            return {
                offsetX: event.touches[0].clientX - rect.left,
                offsetY: event.touches[0].clientY - rect.top
            };
        }
        return { offsetX: event.offsetX, offsetY: event.offsetY };
    };

    const clearSignature = () => {
        if(canvasRef.current) {
            const ctx = canvasRef.current.getContext('2d');
            ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
        }
    };

    useEffect(() => { clearSignature(); }, [mode]);

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
            }
        } catch(e) { }
    };

    const removeItem = (indexToRemove) => {
        setItems(items.filter((_, index) => index !== indexToRemove));
    };

    const addItem = () => {
        if (!itemDesc) return;
        setItems([...items, { desc: itemDesc, cost: parseFloat(itemCost) || 0 }]);
        setItemDesc('');
        setItemCost('');
    };

    const calculateTotal = () => {
        const parts = items.reduce((acc, i) => acc + i.cost, 0);
        const labor = (parseFloat(laborHours) || 0) * (parseFloat(laborRate) || 0);
        const sub = parts + labor;
        const vatPercent = parseFloat(vatRate) || 0;
        const vat = sub * (vatPercent / 100);
        const grandTotal = sub + vat;
        const excessAmount = parseFloat(excess) || 0;
        const finalDue = grandTotal - excessAmount;
        return { parts, labor, sub, vat, grandTotal, excessAmount, finalDue };
    };

    const totals = calculateTotal();

    const clearForm = () => {
        if(window.confirm("Start fresh? This will clear the current form.")) {
            setMode('ESTIMATE');
            setInvoiceNum(''); setInvoiceDate('');
            setName(''); setAddress(''); setPhone(''); setEmail('');
            setReg(''); setMileage(''); setMakeModel(''); setClaimNum(''); setNetworkCode('');
            setItems([]); setLaborHours(''); setExcess(''); setPhotos([]);
            setSaveStatus('IDLE');
            localStorage.removeItem('triple_mmm_draft'); 
            clearSignature();
        }
    }

    const downloadAccountingCSV = () => {
        const invoices = savedEstimates.filter(est => est.type === 'INVOICE');
        if (invoices.length === 0) return alert("No invoices found.");
        let csvContent = "data:text/csv;charset=utf-8,";
        csvContent += "Date,Invoice No,Customer,Reg,Total,Status\n";
        invoices.forEach(inv => {
            const date = inv.createdAt ? new Date(inv.createdAt.seconds * 1000).toLocaleDateString() : 'N/A';
            const status = inv.status || 'UNPAID';
            const row = `${date},${inv.invoiceNumber},${inv.customer},${inv.reg},${inv.totals?.finalDue.toFixed(2)},${status}`;
            csvContent += row + "\n";
        });
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", "TripleMMM_Accounting.csv");
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const saveToCloud = async (type) => {
        if (!name || !reg) return alert("Enter Customer Name & Reg");
        setSaveStatus('SAVING');
        
        try {
            let finalInvNum = invoiceNum;
            if(type === 'INVOICE' && !finalInvNum) {
                finalInvNum = `INV-${1000 + savedEstimates.length + 1}`;
                setInvoiceNum(finalInvNum);
                setInvoiceDate(new Date().toLocaleDateString());
                setMode('INVOICE');
            }

            await addDoc(collection(db, 'estimates'), {
                type: type,
                status: 'UNPAID', 
                invoiceNumber: finalInvNum,
                customer: name, address, phone, email, claimNum, networkCode,
                reg, mileage, makeModel,
                items, laborHours, laborRate, vatRate, excess, photos,
                totals: calculateTotal(),
                createdAt: serverTimestamp(), createdBy: userId
            });
            
            setSaveStatus('SUCCESS');
            setTimeout(() => setSaveStatus('IDLE'), 3000); 
        } catch (error) {
            alert("Error saving: " + error.message);
            setSaveStatus('IDLE');
        }
    };

    if(mode === 'SETTINGS') {
        return (
            <div style={{ padding: '40px', maxWidth: '600px', margin: '0 auto', fontFamily: 'Arial, sans-serif' }}>
                <h2 style={{borderBottom:'2px solid #333', paddingBottom:'10px'}}>⚙️ System Settings</h2>
                <div style={{display:'flex', flexDirection:'column', gap:'15px'}}>
                    <label>Labor Rate (£/hr): <input value={settings.laborRate} onChange={e => setSettings({...settings, laborRate: e.target.value})} style={inputStyle} /></label>
                    <label>Default VAT (%): <input value={settings.vatRate} onChange={e => setSettings({...settings, vatRate: e.target.value})} style={inputStyle} /></label>
                    <label>Company Name: <input value={settings.companyName} onChange={e => setSettings({...settings, companyName: e.target.value})} style={inputStyle} /></label>
                    <label>Address: <textarea value={settings.address} onChange={e => setSettings({...settings, address: e.target.value})} style={{...inputStyle, height:'60px'}} /></label>
                    <label>Phone: <input value={settings.phone} onChange={e => setSettings({...settings, phone: e.target.value})} style={inputStyle} /></label>
                    <label>Email: <input value={settings.email} onChange={e => setSettings({...settings, email: e.target.value})} style={inputStyle} /></label>
                    <div style={{display:'flex', gap:'10px', marginTop:'20px'}}>
                        <button onClick={saveSettings} style={primaryBtn}>SAVE SETTINGS</button>
                        <button onClick={() => setMode('ESTIMATE')} style={secondaryBtn}>CANCEL</button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div style={{ padding: '40px', maxWidth: '900px', margin: '0 auto', fontFamily: 'Arial, sans-serif', background: 'white' }}>
            
            {/* HEADER */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '4px solid #cc0000', paddingBottom: '20px', marginBottom: '30px' }}>
                <div>
                    {!logoError ? (
                        <img 
                            src={process.env.PUBLIC_URL + "/1768639609664.png"} 
                            alt="TRIPLE MMM BODY REPAIRS" 
                            style={{ maxHeight: '200px', maxWidth: '100%', objectFit: 'contain', mixBlendMode: 'multiply' }}
                            onError={() => setLogoError(true)} 
                        />
                    ) : (
                        <div style={{ fontSize: '3em', fontWeight: '900', letterSpacing: '-2px', lineHeight:'0.9' }}>
                            <span style={{color: 'black'}}>{settings.companyName.split(' ')[0]}</span><br/>
                            <span style={{color: '#cc0000'}}>{settings.companyName.split(' ').slice(1).join(' ')}</span>
                        </div>
                    )}
                </div>
                <div style={{ textAlign: 'right', fontSize: '0.9em', color: '#333', lineHeight: '1.4' }}>
                    <div style={{ fontWeight: 'bold', fontSize: '1.1em', marginBottom: '5px' }}>{settings.address}</div>
                    <div>Tel: <strong>{settings.phone}</strong></div>
                    <div>Email: {settings.email}</div>
                </div>
            </div>

            {/* TITLE */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '30px' }}>
                <div>
                    <h2 style={{ margin: 0, fontSize: '2em', color: mode === 'JOBCARD' ? '#333' : (mode === 'SATISFACTION' ? '#d97706' : '#333'), textTransform: 'uppercase' }}>
                        {mode === 'JOBCARD' ? 'WORKSHOP JOB CARD' : (mode === 'SATISFACTION' ? 'SATISFACTION NOTE' : mode)}
                    </h2>
                </div>
                {mode !== 'ESTIMATE' && mode !== 'JOBCARD' && (
                    <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: '1.2em', fontWeight: 'bold' }}>{invoiceNum}</div>
                        <div>Date: {invoiceDate || new Date().toLocaleDateString()}</div>
                    </div>
                )}
            </div>

            {/* DETAILS FORM */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '30px', marginBottom: '30px', border: '1px solid #eee', padding: '20px', borderRadius: '8px' }}>
                <div>
                    <h4 style={headerStyle}>CLIENT DETAILS</h4>
                    <input placeholder="Name" value={name} onChange={e => setName(e.target.value)} style={inputStyle} />
                    <textarea placeholder="Address" value={address} onChange={e => setAddress(e.target.value)} style={{...inputStyle, height: '60px', fontFamily: 'inherit'}} />
                    <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:'5px'}}>
                        <input placeholder="Phone" value={phone} onChange={e => setPhone(e.target.value)} style={inputStyle} />
                        <input placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} style={inputStyle} />
                    </div>
                    <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:'5px', marginTop:'5px'}}>
                        <input placeholder="Claim No." value={claimNum} onChange={e => setClaimNum(e.target.value)} style={{...inputStyle, border:'1px solid #2563eb'}} />
                        <input placeholder="Network Code" value={networkCode} onChange={e => setNetworkCode(e.target.value)} style={{...inputStyle, border:'1px solid #2563eb'}} />
                    </div>
                </div>
                <div>
                    <h4 style={headerStyle}>VEHICLE DETAILS</h4>
                    <div style={{display:'flex', gap:'10px'}}>
                        <input placeholder="Reg" value={reg} onChange={e => setReg(e.target.value)} onBlur={() => checkHistory(reg)} style={{...inputStyle, fontWeight:'bold', textTransform:'uppercase', background:'#f0f9ff'}} />
                        <input placeholder="Mileage" value={mileage} onChange={e => setMileage(e.target.value)} style={inputStyle} />
                    </div>
                    <input placeholder="Make / Model" value={makeModel} onChange={e => setMakeModel(e.target.value)} style={inputStyle} />
                    
                    <div className="no-print" style={{marginTop:'100px', background:'#f0fdf4', padding:'10px', borderRadius:'4px', border:'1px dashed #16a34a'}}>
                        <label style={{display:'block', marginBottom:'5px', fontSize:'0.9em', color:'#166534'}}>Add Damage Photos:</label>
                        <input type="file" accept="image/*" onChange={handlePhotoUpload} disabled={uploading} />
                        {uploading && <span style={{fontSize:'0.8em'}}>Uploading...</span>}
                    </div>
                </div>
            </div>

            {/* PHOTOS */}
            {photos.length > 0 && (
                <div style={{marginBottom:'20px', display:'flex', gap:'10px', flexWrap:'wrap'}}>
                    {photos.map((url, i) => (
                        <div key={i} style={{position:'relative', width:'100px', height:'100px'}}>
                            <img src={url} alt="Damage" style={{width:'100%', height:'100%', objectFit:'cover', borderRadius:'4px', border:'1px solid #ddd'}} />
                            <button className="no-print" onClick={() => removePhoto(i)} style={{position:'absolute', top:-5, right:-5, background:'red', color:'white', borderRadius:'50%', border:'none', width:'20px', height:'20px', cursor:'pointer'}}>×</button>
                        </div>
                    ))}
                </div>
            )}

            {mode !== 'SATISFACTION' && (
                <>
                    <div className="no-print" style={{ background: '#f8fafc', padding: '15px', marginBottom: '15px', borderRadius: '8px' }}>
                        <div style={{ display: 'flex', gap: '10px' }}>
                            <input placeholder="Add Repair Item..." value={itemDesc} onChange={e => setItemDesc(e.target.value)} style={{ flexGrow: 1, padding: '10px' }} />
                            <input type="number" placeholder="Cost" value={itemCost} onChange={e => setItemCost(e.target.value)} style={{ width: '80px', padding: '10px' }} />
                            <button onClick={addItem} style={{ background: '#333', color: 'white', border: 'none', padding: '10px 20px', borderRadius: '4px', cursor: 'pointer' }}>Add</button>
                        </div>
                    </div>
                    
                    <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '30px' }}>
                        <thead>
                            <tr style={{textAlign:'left', borderBottom:'2px solid #333', color: '#333'}}>
                                <th style={{padding:'10px'}}>DESCRIPTION OF WORK</th>
                                {mode === 'JOBCARD' && <th style={{width:'50px', textAlign:'center'}}>CHECK</th>}
                                {mode !== 'JOBCARD' && <th style={{textAlign:'right', padding:'10px'}}>AMOUNT</th>}
                                <th className="no-print" style={{width:'30px'}}></th>
                            </tr>
                        </thead>
                        <tbody>
                            {items.map((item, i) => (
                                <tr key={i} style={{ borderBottom: '1px solid #eee' }}>
                                    <td style={{padding:'12px 10px'}}>{item.desc}</td>
                                    {mode === 'JOBCARD' && <td style={{border:'1px solid #ddd'}}></td>}
                                    {mode !== 'JOBCARD' && <td style={{textAlign:'right', padding:'12px 10px'}}>£{item.cost.toFixed(2)}</td>}
                                    <td className="no-print" style={{textAlign:'center'}}>
                                        <button onClick={() => removeItem(i)} style={{background:'#ef4444', color:'white', border:'none', borderRadius:'50%', width:'24px', height:'24px', cursor:'pointer', fontWeight:'bold'}}>×</button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>

                    {mode !== 'JOBCARD' && (
                        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                            <div style={{ width: '300px', textAlign: 'right' }}>
                                <div className="no-print" style={{marginBottom:'10px'}}>
                                    Labor: <input type="number" value={laborHours} onChange={e => setLaborHours(e.target.value)} style={{width:'50px'}} /> hrs @ £
                                    <input type="number" value={laborRate} onChange={e => setLaborRate(e.target.value)} style={{width:'50px'}} />
                                </div>
                                <div style={rowStyle}><span>Labor Total:</span> <span>£{totals.labor.toFixed(2)}</span></div>
                                <div style={rowStyle}><span>Parts Total:</span> <span>£{totals.parts.toFixed(2)}</span></div>
                                <div style={rowStyle}><span>Subtotal:</span> <span>£{totals.sub.toFixed(2)}</span></div>
                                <div style={rowStyle}>
                                    <span>VAT ({vatRate}%):</span> 
                                    <span className="no-print"><input type="number" value={vatRate} onChange={e => setVatRate(e.target.value)} style={{width:'40px'}} /></span>
                                    <span style={{marginLeft:'5px'}}>£{totals.vat.toFixed(2)}</span>
                                </div>
                                <div style={{...rowStyle, fontSize:'1.2em', fontWeight:'bold', borderTop:'2px solid #333', marginTop:'5px'}}>
                                    <span>GRAND TOTAL:</span> <span>£{totals.grandTotal.toFixed(2)}</span>
                                </div>
                                <div style={{...rowStyle, color:'#dc2626'}}>
                                    <span>Less Excess:</span>
                                    <span className="no-print"><input type="number" value={excess} onChange={e => setExcess(e.target.value)} style={{width:'60px'}} /></span> 
                                    <span>-£{totals.excessAmount.toFixed(2)}</span>
                                </div>
                                <div style={{...rowStyle, fontSize:'1.4em', fontWeight:'bold', color:'#333', borderTop:'2px solid #333', marginTop:'5px', paddingTop:'10px'}}>
                                    <span>BALANCE DUE:</span> <span>£{totals.finalDue.toFixed(2)}</span>
                                </div>
                            </div>
                        </div>
                    )}

                    {(mode === 'INVOICE' || mode === 'JOBCARD') && (
                        <div style={{ marginTop: '50px', padding: '20px', background: '#f9f9f9', borderRadius: '8px', display: 'flex', justifyContent: 'space-between', border: '1px solid #ddd' }}>
                            {mode === 'INVOICE' && (
                                <div>
                                    <h4 style={{margin:'0 0 10px 0'}}>PAYMENT DETAILS</h4>
                                    <div style={{fontSize:'0.9em', lineHeight:'1.6'}}>
                                        Account Name: <strong>{settings.companyName} BODY REPAIRS</strong><br/>
                                        Account No: <strong>06163462</strong><br/>
                                        Sort Code: <strong>80-22-60</strong><br/>
                                        Bank: <strong>BANK OF SCOTLAND</strong>
                                    </div>
                                </div>
                            )}
                            {mode === 'JOBCARD' && (
                                <div><strong>Technician Notes:</strong><br/><br/>_______________________</div>
                            )}
                            <div style={{ textAlign: 'center', width: '350px', marginTop: '20px' }}>
                                <div className="no-print" style={{border: '1px dashed #ccc', height: '100px', backgroundColor: '#fff', position: 'relative', marginBottom:'5px'}}>
                                    <canvas ref={canvasRef} width={350} height={100} onMouseDown={startDrawing} onMouseMove={draw} onMouseUp={stopDrawing} onMouseLeave={stopDrawing} onTouchStart={startDrawing} onTouchMove={draw} onTouchEnd={stopDrawing} style={{width: '100%', height: '100%', touchAction: 'none'}} />
                                    <button onClick={clearSignature} style={{position: 'absolute', top: 5, right: 5, fontSize: '0.7em', padding: '2px 5px'}}>Clear</button>
                                </div>
                                <div style={{ borderBottom: '1px solid #333', height: '40px', marginBottom: '5px' }}></div>
                                <div style={{fontSize:'0.8em', color:'#666'}}>{mode === 'JOBCARD' ? 'TECHNICIAN SIGNATURE' : 'AUTHORISED SIGNATURE'}</div>
                            </div>
                        </div>
                    )}
                </>
            )}

            {mode === 'SATISFACTION' && (
                <div style={{ marginTop: '20px', padding: '30px', border: '2px solid #333' }}>
                    <p style={{ lineHeight: '1.8', fontSize: '1.1em' }}>
                        I/We being the owner/policyholder of vehicle registration <strong>{reg}</strong> hereby confirm that the repairs attended to by <strong>{settings.companyName} BODY REPAIRS</strong> have been completed to my/our entire satisfaction.
                    </p>
                    <p style={{ lineHeight: '1.8', fontSize: '1.1em' }}>
                        I/We authorize payment to be made directly to the repairer in respect of the invoice number <strong>{invoiceNum}</strong> relative to this claim.
                    </p>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '80px', gap: '20px' }}>
                        <div style={{ width: '45%' }}>
                            <div className="no-print" style={{border: '1px dashed #ccc', height: '100px', backgroundColor: '#fff', position: 'relative', marginBottom:'5px'}}>
                                <canvas ref={canvasRef} width={350} height={100} onMouseDown={startDrawing} onMouseMove={draw} onMouseUp={stopDrawing} onMouseLeave={stopDrawing} onTouchStart={startDrawing} onTouchMove={draw} onTouchEnd={stopDrawing} style={{width: '100%', height: '100%', touchAction: 'none'}} />
                                <button onClick={clearSignature} style={{position: 'absolute', top: 5, right: 5, fontSize: '0.7em', padding: '2px 5px'}}>Clear</button>
                            </div>
                            <div style={{ borderBottom: '1px solid #333', marginBottom: '10px' }}></div>
                            <strong>Customer Signature</strong>
                        </div>
                        <div style={{ width: '45%' }}>
                            <div style={{ borderBottom: '1px solid #333', height: '100px', marginBottom: '10px', display:'flex', alignItems:'flex-end' }}>
                                <span>{new Date().toLocaleDateString()}</span>
                            </div>
                            <strong>Date</strong>
                        </div>
                    </div>
                </div>
            )}

            <div className="no-print" style={{ position: 'fixed', bottom: 0, left: 0, right: 0, padding: '15px', background: 'white', borderTop: '1px solid #ccc', display: 'flex', justifyContent: 'center', gap: '15px', boxShadow: '0 -2px 10px rgba(0,0,0,0.1)', flexWrap: 'wrap' }}>
                <button onClick={() => saveToCloud('ESTIMATE')} disabled={saveStatus === 'SAVING'} style={saveStatus === 'SUCCESS' ? successBtn : primaryBtn}>
                    {saveStatus === 'SAVING' ? 'SAVING...' : (saveStatus === 'SUCCESS' ? '✅ SAVED!' : 'SAVE ESTIMATE')}
                </button>
                {mode === 'ESTIMATE' && <button onClick={() => saveToCloud('INVOICE')} style={secondaryBtn}>GENERATE INVOICE</button>}
                <button onClick={() => setMode('JOBCARD')} style={{...secondaryBtn, background: '#4b5563'}}>JOB CARD</button>
                {mode === 'INVOICE' && <button onClick={() => setMode('SATISFACTION')} style={{...secondaryBtn, background: '#d97706'}}>SATISFACTION NOTE</button>}
                <button onClick={() => window.print()} style={{...secondaryBtn, background: '#333'}}>PRINT / PDF</button>
                <button onClick={clearForm} style={{...secondaryBtn, background: '#ef4444'}}>NEW JOB</button>
                <button onClick={() => setMode('SETTINGS')} style={{...secondaryBtn, background: '#666'}}>⚙️ SETTINGS</button>
            </div>

            <div className="no-print" style={{marginTop:'100px', paddingBottom:'80px'}}>
                <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', borderBottom:'1px solid #eee', marginBottom:'15px'}}>
                    <h3 style={{color:'#888'}}>Recent Jobs</h3>
                    <input 
                        placeholder="Search jobs..." 
                        value={searchTerm} 
                        onChange={e => setSearchTerm(e.target.value)} 
                        style={{padding:'8px', border:'1px solid #ccc', borderRadius:'4px'}} 
                    />
                    <button onClick={downloadAccountingCSV} style={{background:'#0f766e', color:'white', border:'none', padding:'8px 15px', borderRadius:'4px', cursor:'pointer', fontSize:'0.9em'}}>
                        📥 Export Accounting CSV
                    </button>
                </div>
                
                {filteredEstimates.map(est => (
                    <div key={est.id} style={{padding:'10px', borderBottom:'1px solid #eee', display:'flex', justifyContent:'space-between', alignItems:'center', backgroundColor: est.status === 'PAID' ? '#f0fdf4' : 'transparent'}}>
                        <div style={{color: est.type === 'INVOICE' ? '#16a34a' : '#333'}}>
                            <span>{est.type === 'INVOICE' ? `📄 ${est.invoiceNumber}` : '📝 Estimate'} - {est.customer} ({est.reg})</span>
                            <div style={{fontSize:'0.8em', color:'#666'}}>{new Date(est.createdAt?.seconds * 1000).toLocaleDateString()} - £{est.totals?.finalDue.toFixed(2)}</div>
                        </div>
                        <button onClick={() => togglePaid(est.id, est.status)} style={{padding:'5px 10px', border:'1px solid #ccc', borderRadius:'4px', background: est.status === 'PAID' ? '#16a34a' : 'white', color: est.status === 'PAID' ? 'white' : '#333', cursor:'pointer'}}>
                            {est.status === 'PAID' ? 'PAID' : 'MARK PAID'}
                        </button>
                    </div>
                ))}
            </div>

            <style>{`
                @media print {
                    .no-print { display: none !important; }
                    body { padding: 0; margin: 0; background: white; }
                    input, textarea { border: none !important; resize: none; font-family: inherit; }
                    input::placeholder, textarea::placeholder { color: transparent; }
                }
            `}</style>
        </div>
    );
};

const App = () => {
    const [u, sU] = useState(null);
    useEffect(() => onAuthStateChanged(auth, (user) => user ? sU(user.uid) : signInAnonymously(auth)), []);
    if (!u) return <div style={{padding:'20px'}}>Loading System...</div>;
    return <EstimateApp userId={u} />;
};

export default App;
