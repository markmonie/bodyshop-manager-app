            {page === 'WORKSHOP' && (
                <>
                    {/* PARTS MATRIX MODULE */}
                    <div style={s.card}>
                        <span style={s.label}>Add Repair Parts (Cost Price)</span>
                        <div style={{display:'flex', gap:'10px', marginBottom:'10px'}}>
                            <input id="pN" placeholder="Part Name" style={{...s.input, flex:2, marginBottom:0}} />
                            <input id="pC" type="number" placeholder="Cost £" style={{...s.input, flex:1, marginBottom:0}} />
                            <button onClick={() => {
                                const n = document.getElementById('pN'), c = document.getElementById('pC');
                                if (!n.value || !c.value) return;
                                setRepair({...repair, items: [...repair.items, { desc: n.value, cost: c.value }]});
                                n.value = ''; c.value = '';
                            }} style={s.btnGreen}>+</button>
                        </div>
                        {repair.items.map((it, i) => (
                            <div key={i} style={{display:'flex', justifyContent:'space-between', padding:'8px 0', borderBottom:'1px solid #334155'}}>
                                <span>{it.desc}</span>
                                <strong>£{(parseFloat(it.cost) * (1 + (parseFloat(settings.markup) / 100))).toFixed(2)}</strong>
                            </div>
                        ))}
                    </div>

                    {/* LABOUR & PAINT MODULE */}
                    <div style={s.card}>
                        <span style={s.label}>Labour & Paint Materials</span>
                        <div style={{display:'grid', gridTemplateColumns: '1fr 1fr', gap: '10px'}}>
                            <input style={s.input} type="number" placeholder="Labour Hours" value={repair.labourHours} onChange={e => setRepair({...repair, labourHours: e.target.value})} />
                            <input style={s.input} type="number" placeholder="Paint & Mats £" value={repair.paintMaterials} onChange={e => setRepair({...repair, paintMaterials: e.target.value})} />
                        </div>
                    </div>
                </>
            )}
