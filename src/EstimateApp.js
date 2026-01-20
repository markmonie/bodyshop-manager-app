                                    <h4 style={{margin:'0 0 5px 0', color:'#991b1b'}}>Internal Job Costs (Profit Check)</h4>
                                    <div style={rowStyle}><span>Allocated Materials:</span> <input type="number" value={paintAllocated} onChange={e => setPaintAllocated(e.target.value)} style={{width:'60px'}} /></div>
                                    <div style={rowStyle}><span>Parts Cost:</span> <span>£{totals.partsCost.toFixed(2)}</span></div>
                                    <div style={{...rowStyle, fontWeight:'bold', color: totals.jobProfit > 0 ? 'green' : 'red'}}><span>Job Profit:</span> <span>£{totals.jobProfit.toFixed(2)}</span></div>
                                </div>
                            </div>
                        </div>
                    )}
                    {(mode === 'INVOICE' || mode === 'JOBCARD') && (
                        <div style={{ marginTop: '50px', padding: '20px', background: '#f9f9f9', borderRadius: '8px', display: 'flex', justifyContent: 'space-between', border: '1px solid #ddd' }}>
                            {mode === 'INVOICE' && <div><h4 style={{margin:'0 0 10px 0'}}>PAYMENT DETAILS</h4><div style={{fontSize:'0.9em', lineHeight:'1.6'}}>Account Name: <strong>{settings.companyName} BODY REPAIRS</strong><br/>Account No: <strong>06163462</strong><br/>Sort Code: <strong>80-22-60</strong><br/>Bank: <strong>BANK OF SCOTLAND</strong></div></div>}
                            {mode === 'JOBCARD' && <div><strong>Technician Notes:</strong><br/><br/>_______________________</div>}
                            <div style={{ textAlign: 'center', width: '350px', marginTop: '20px' }}>
                                <div className="no-print" style={{border: '1px dashed #ccc', height: '100px', backgroundColor: '#fff', position: 'relative', marginBottom:'5px'}}><canvas ref={canvasRef} width={350} height={100} onMouseDown={startDrawing} onMouseMove={draw} onMouseUp={stopDrawing} onMouseLeave={stopDrawing} onTouchStart={startDrawing} onTouchMove={draw} onTouchEnd={stopDrawing} style={{width: '100%', height: '100%', touchAction: 'none'}} /><button onClick={clearSignature} style={{position: 'absolute', top: 5, right: 5, fontSize: '0.7em', padding: '2px 5px'}}>Clear</button></div>
                                <div style={{ borderBottom: '1px solid #333', height: '40px', marginBottom: '5px' }}></div>
                                <div style={{fontSize:'0.8em', color:'#666'}}>{mode === 'JOBCARD' ? 'TECHNICIAN SIGNATURE' : 'AUTHORISED SIGNATURE'}</div>
                            </div>
                        </div>
                    )}
                </>
            )}

            {mode === 'SATISFACTION' && (
                <div style={{ marginTop: '20px', padding: '30px', border: '2px solid #333' }}>
                    <p style={{ lineHeight: '1.8', fontSize: '1.1em' }}>I/We being the owner/policyholder of vehicle registration <strong>{reg}</strong> hereby confirm that the repairs attended to by <strong>{settings.companyName} BODY REPAIRS</strong> have been completed to my/our entire satisfaction.</p>
                    <p style={{ lineHeight: '1.8', fontSize: '1.1em' }}>I/We authorize payment to be made directly to the repairer in respect of the invoice number <strong>{invoiceNum}</strong> relative to this claim.</p>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '80px', gap: '20px' }}>
                        <div style={{ width: '45%' }}><div className="no-print" style={{border: '1px dashed #ccc', height: '100px', backgroundColor: '#fff', position: 'relative', marginBottom:'5px'}}><canvas ref={canvasRef} width={350} height={100} onMouseDown={startDrawing} onMouseMove={draw} onMouseUp={stopDrawing} onMouseLeave={stopDrawing} onTouchStart={startDrawing} onTouchMove={draw} onTouchEnd={stopDrawing} style={{width: '100%', height: '100%', touchAction: 'none'}} /><button onClick={clearSignature} style={{position: 'absolute', top: 5, right: 5, fontSize: '0.7em', padding: '2px 5px'}}>Clear</button></div><div style={{ borderBottom: '1px solid #333', marginBottom: '10px' }}></div><strong>Customer Signature</strong></div>
                        <div style={{ width: '45%' }}><div style={{ borderBottom: '1px solid #333', height: '100px', marginBottom: '10px', display:'flex', alignItems:'flex-end' }}><span>{new Date().toLocaleDateString()}</span></div><strong>Date</strong></div>
                    </div>
                </div>
            )}

            <div className="no-print" style={{ position: 'fixed', bottom: 0, left: 0, right: 0, padding: '15px', background: 'white', borderTop: '1px solid #ccc', display: 'flex', justifyContent: 'center', gap: '15px', boxShadow: '0 -2px 10px rgba(0,0,0,0.1)', flexWrap: 'wrap' }}>
                <button onClick={() => saveToCloud('ESTIMATE')} disabled={saveStatus === 'SAVING'} style={saveStatus === 'SUCCESS' ? successBtn : primaryBtn}>{saveStatus === 'SAVING' ? 'SAVING...' : (saveStatus === 'SUCCESS' ? '✅ SAVED!' : 'SAVE ESTIMATE')}</button>
                {mode === 'ESTIMATE' && <button onClick={() => saveToCloud('INVOICE')} style={secondaryBtn}>GENERATE INVOICE</button>}
                <button onClick={() => setMode('JOBCARD')} style={{...secondaryBtn, background: '#4b5563'}}>JOB CARD</button>
                {mode === 'INVOICE' && <button onClick={() => setMode('SATISFACTION')} style={{...secondaryBtn, background: '#d97706'}}>SATISFACTION NOTE</button>}
                <button onClick={() => window.print()} style={{...secondaryBtn, background: '#333'}}>PRINT</button>
                <button onClick={clearForm} style={{...secondaryBtn, background: '#ef4444'}}>NEW JOB</button>
                <button onClick={() => setMode('SETTINGS')} style={{...secondaryBtn, background: '#666'}}>⚙️</button>
                <button onClick={() => setMode('DASHBOARD')} style={{...secondaryBtn, background: '#0f766e'}}>📊</button>
            </div>

            <div className="no-print" style={{marginTop:'100px', paddingBottom:'80px'}}>
                <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', borderBottom:'1px solid #eee', marginBottom:'15px'}}>
                    <h3 style={{color:'#888'}}>Recent Jobs</h3>
                    <input placeholder="Search jobs..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} style={{padding:'8px', border:'1px solid #ccc', borderRadius:'4px'}} />
                    <button onClick={downloadAccountingCSV} style={{background:'#0f766e', color:'white', border:'none', padding:'8px 15px', borderRadius:'4px', cursor:'pointer', fontSize:'0.9em'}}>📥 Export CSV</button>
                </div>
                {filteredEstimates.map(est => (<div key={est.id} style={{padding:'10px', borderBottom:'1px solid #eee', display:'flex', justifyContent:'space-between', alignItems:'center', backgroundColor: est.status === 'PAID' ? '#f0fdf4' : 'transparent'}}><div style={{color: est.type === 'INVOICE' ? '#16a34a' : '#333'}}><span>{est.type === 'INVOICE' ? `📄 ${est.invoiceNumber}` : '📝 Estimate'} - {est.customer} ({est.reg})</span><div style={{fontSize:'0.8em', color:'#666'}}>{new Date(est.createdAt?.seconds * 1000).toLocaleDateString()} - £{est.totals?.finalDue.toFixed(2)}</div></div><div style={{display:'flex', gap:'5px'}}><button onClick={() => deleteJob(est.id)} style={{border:'none', background:'none', color:'#ef4444', fontSize:'1.2em', cursor:'pointer'}}>🗑️</button><button onClick={() => togglePaid(est.id, est.status)} style={{padding:'5px 10px', border:'1px solid #ccc', borderRadius:'4px', background: est.status === 'PAID' ? '#16a34a' : 'white', color: est.status === 'PAID' ? 'white' : '#333', cursor:'pointer'}}>{est.status === 'PAID' ? 'PAID' : 'MARK PAID'}</button></div></div>))}
            </div>

            <style>{`@media print { .no-print { display: none !important; } body { padding: 0; margin: 0; } }`}</style>
        </div>
    );
