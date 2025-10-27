import React, { useState, useEffect, useMemo, useRef } from 'react';

// --- CONFIGURATION CONSTANTS (Easily modifiable) ---
const MAX_STORES_PER_ITEM = 10;
const MAX_REUSABLE_STORES = 50;
const DEFAULT_CATEGORIES = ['Produce', 'Dairy', 'Meat', 'Pantry', 'Frozen', 'Household', 'Snacks', 'Other'];
const STATUS_OPTIONS = [
    { value: 'Depleted', label: 'Depleted', color: 'bg-red-600', dot: 'bg-red-400' },
    { value: 'Running Low', label: 'Low', color: 'bg-yellow-600', dot: 'bg-yellow-400' },
    { value: 'Home Stocked', label: 'Home Stocked', color: 'bg-green-600', dot: 'bg-green-400' },
];
const STATUS_CYCLE = ['Depleted', 'Running Low', 'Home Stocked'];

// Initial data source is now empty, as data will be loaded from IndexedDB
const initialItems = [];
const initialStores = [];


// --- INDEXEDDB UTILITIES ---
const DB_NAME = 'GroceryDB';
const DB_VERSION = 1;
const ITEM_STORE = 'items';
const STORE_STORE = 'stores';

/**
 * Opens the IndexedDB connection and initializes object stores if needed.
 */
const openDB = () => {
    return new Promise((resolve, reject) => {
        if (!window.indexedDB) {
            console.error("IndexedDB not supported.");
            reject("IndexedDB not supported.");
            return;
        }

        const request = window.indexedDB.open(DB_NAME, DB_VERSION);

        request.onupgradeneeded = (event) => {
            const db = event.target.result;
            // Create the 'items' object store with 'id' as the key path
            if (!db.objectStoreNames.contains(ITEM_STORE)) {
                db.createObjectStore(ITEM_STORE, { keyPath: 'id' });
            }
            // Create the 'stores' object store with 'id' as the key path
            if (!db.objectStoreNames.contains(STORE_STORE)) {
                db.createObjectStore(STORE_STORE, { keyPath: 'id' });
            }
        };

        request.onsuccess = (event) => {
            resolve(event.target.result);
        };

        request.onerror = (event) => {
            console.error("Database error: ", event.target.errorCode);
            reject(event.target.error);
        };
    });
};

/**
 * Executes a transaction against a specific object store.
 * @param {string} storeName - Name of the object store.
 * @param {string} mode - Transaction mode ('readonly' or 'readwrite').
 * @param {function} callback - Function to execute inside the transaction.
 */
const executeDBTransaction = (storeName, mode, callback) => {
    return new Promise(async (resolve, reject) => {
        try {
            const db = await openDB();
            const transaction = db.transaction([storeName], mode);
            const store = transaction.objectStore(storeName);

            transaction.oncomplete = () => resolve();
            transaction.onerror = (event) => {
                console.error(`Transaction error (${storeName}): `, event.target.error);
                reject(event.target.error);
            };

            callback(store, resolve, reject);
        } catch (error) {
            console.error("Error opening DB for transaction:", error);
            reject(error);
        }
    });
};

// --- CRUD Operations for Items (IndexedDB) ---

const loadAllItemsDB = () => new Promise(async (resolve) => {
    await executeDBTransaction(ITEM_STORE, 'readonly', (store) => {
        const request = store.getAll();
        request.onsuccess = (event) => resolve(event.target.result || []);
        request.onerror = () => resolve([]); // Return empty array on read error
    });
});

const addItemDB = (item) => executeDBTransaction(ITEM_STORE, 'readwrite', (store) => { store.add(item); });
const updateItemDB = (item) => executeDBTransaction(ITEM_STORE, 'readwrite', (store) => { store.put(item); });
const deleteItemDB = (itemId) => executeDBTransaction(ITEM_STORE, 'readwrite', (store) => { store.delete(itemId); });

// --- CRUD Operations for Stores (IndexedDB) ---

const loadAllStoresDB = () => new Promise(async (resolve) => {
    await executeDBTransaction(STORE_STORE, 'readonly', (store) => {
        const request = store.getAll();
        request.onsuccess = (event) => resolve(event.target.result || []);
        request.onerror = () => resolve([]); // Return empty array on read error
    });
});

const addStoreDB = (store) => executeDBTransaction(STORE_STORE, 'readwrite', (storeObj) => { storeObj.add(store); });
const deleteStoreDB = (storeId) => executeDBTransaction(STORE_STORE, 'readwrite', (storeObj) => { storeObj.delete(storeId); });


// --- UTILITY COMPONENTS (Unchanged) ---

// Enhanced Button with Modern/Mobile Feel
const MobileButton = ({ children, onClick, className = '', disabled = false, title = '' }) => (
    <button
        onClick={onClick}
        disabled={disabled}
        title={title}
        className={`
            w-full px-5 py-3 rounded-xl font-bold text-white transition duration-300
            bg-red-800/80 shadow-lg shadow-red-900/40
            hover:bg-red-700/90 active:bg-red-900
            focus:outline-none focus:ring-4 focus:ring-red-400/50
            disabled:opacity-40 disabled:cursor-not-allowed disabled:shadow-none disabled:hover:bg-red-800/80
            ${className}
        `}
    >
        {children}
    </button>
);

// Enhanced Card with Deep Glassmorphism Effect
const DeepCard = ({ children, className = '', onClick }) => (
    <div
        onClick={onClick}
        className={`
            bg-black bg-opacity-60 backdrop-filter backdrop-blur-xl
            p-5 rounded-3xl shadow-[0_15px_30px_rgba(0,0,0,0.5)] border border-red-900/50
            ${className}
        `}
    >
        {children}
    </div>
);

// Quantity Control Button (Small for table)
const QuantityButton = ({ children, onClick, className = '', disabled = false, title = '' }) => (
    <button
        onClick={onClick}
        disabled={disabled}
        title={title}
        className={`
            w-8 h-8 rounded-full font-bold text-lg text-white transition duration-200
            bg-black/50 border border-red-900/50
            hover:bg-red-800/70 active:scale-95
            disabled:opacity-30 disabled:cursor-not-allowed
            ${className}
        `}
    >
        {children}
    </button>
);


const Modal = ({ children, onClose }) => (
    <div className="fixed inset-0 bg-black bg-opacity-80 flex items-center justify-center z-50 p-4" onClick={onClose}>
        <DeepCard
            className="w-full max-w-lg max-h-[95vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
        >
            {children}
        </DeepCard>
    </div>
);

// --- Action Dropdown Component ---
const ActionDropdown = ({ onEdit, onDelete }) => {
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef(null);

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
                setIsOpen(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleAction = (actionFn) => {
        setIsOpen(false);
        actionFn();
    };

    return (
        <div className="relative inline-block text-left" ref={dropdownRef}>
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="w-8 h-8 p-0 flex items-center justify-center rounded-full bg-black/50 text-white hover:bg-red-800/70 transition duration-150"
                title="Item Actions"
            >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z"></path></svg>
            </button>

            {isOpen && (
                <div className="absolute right-0 mt-2 w-36 origin-top-right z-10">
                    <DeepCard className="p-1 !pb-0 !pr-0 !pl-0 !pt-0 bg-black/80">
                        <button
                            onClick={() => handleAction(onEdit)}
                            className="w-full text-left px-4 py-2 text-sm text-gray-200 rounded-t-xl hover:bg-red-900/70 transition duration-100 block"
                        >
                            Edit Item
                        </button>
                        <button
                            onClick={() => handleAction(onDelete)}
                            className="w-full text-left px-4 py-2 text-sm text-red-400 rounded-b-xl hover:bg-red-800/60 transition duration-100 block border-t border-red-900/50"
                        >
                            Delete
                        </button>
                    </DeepCard>
                </div>
            )}
        </div>
    );
};
// --- END: Action Dropdown Component ---


// --- BARCODE SCANNER MODAL (Simplified for UI/UX) ---

const BarcodeScannerModal = ({ onClose, onScanComplete }) => {
    const videoRef = useRef(null);
    const [status, setStatus] = useState('Camera initialization...');
    const [stream, setStream] = useState(null);

    useEffect(() => {
        if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
            navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } })
                .then((mediaStream) => {
                    if (videoRef.current) {
                        videoRef.current.srcObject = mediaStream;
                        videoRef.current.play();
                        setStream(mediaStream);
                        setStatus('Ready to scan. Point at a UPC.');
                    }
                })
                .catch((err) => {
                    console.error("Camera access failed:", err);
                    setStatus('Error: Camera access required to simulate scan.');
                });
        } else {
            setStatus('Error: Browser does not support camera access.');
        }

        return () => {
            if (stream) {
                stream.getTracks().forEach(track => track.stop());
            }
        };
    }, []);

    const simulateScan = () => {
        if (!stream) return;
        setStatus('Scanning...');
        const mockBarcode = '978' + Math.floor(Math.random() * 9000000000).toString().padStart(10, '0');

        setTimeout(() => {
            console.log(`[BARCODE SCANNED]: ${mockBarcode}`);
            setStatus(`Scan successful: ${mockBarcode}`);
            onScanComplete(mockBarcode);
        }, 1200);
    };


    return (
        <Modal onClose={onClose}>
            <h2 className="text-3xl font-extrabold text-white mb-6 border-b border-red-700 pb-2">Barcode Scanner</h2>
            <div className="relative w-full aspect-square bg-black rounded-xl overflow-hidden border-2 border-red-700/70">
                <video ref={videoRef} className="w-full h-full object-cover" style={{ transform: 'scaleX(-1)' }} playsInline></video>
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    {/* Visual scanning line with animation */}
                    <div className="w-full h-1 bg-red-400 shadow-xl shadow-red-400/80 animate-pulse-slow"></div>
                    <style>{`
                        @keyframes pulse-slow { 
                            0%, 100% { opacity: 0.5; } 
                            50% { opacity: 1.0; }
                        }
                        .animate-pulse-slow {
                            animation: pulse-slow 2s infinite ease-in-out;
                        }
                    `}</style>
                </div>
            </div>

            <p className="mt-4 text-center text-sm text-gray-400">{status}</p>

            <div className="flex justify-between space-x-4 pt-4 border-t border-red-900/40 mt-4">
                <MobileButton
                    onClick={simulateScan}
                    disabled={!stream || status.includes('Scanning')}
                    className="flex-grow bg-red-600/90 hover:bg-red-500/90 shadow-red-700/50"
                >
                    Capture Barcode
                </MobileButton>
                <MobileButton onClick={onClose} className="w-1/4 bg-black/50 hover:bg-red-900/70">X</MobileButton>
            </div>
        </Modal>
    );
};


// --- MODAL & FORM COMPONENTS (Unchanged logic) ---

// Helper function to get store options unique to the current slot
const getAvailableStoreOptions = (currentIndex, allStores, currentSelections) => {
    const selectedNames = currentSelections
        .map((s, i) => i !== currentIndex ? s.storeName : null)
        .filter(Boolean);

    return allStores
        .filter(store => !selectedNames.includes(store.name));
};


const StorePriceEditor = ({ item, setLocalItem, stores }) => {

    const handleAddStorePrice = () => {
        if (item.stores.length >= MAX_STORES_PER_ITEM) return;
        setLocalItem(prev => ({
            ...prev,
            stores: [...prev.stores, { storeName: '', price: '' }]
        }));
    };

    const handleUpdateStorePrice = (index, key, value) => {
        setLocalItem(prev => {
            const newStores = [...prev.stores];
            newStores[index] = { ...newStores[index], [key]: value };
            return { ...prev, stores: newStores };
        });
    };

    const handleRemoveStorePrice = (index) => {
        setLocalItem(prev => ({
            ...prev,
            stores: prev.stores.filter((_, i) => i !== index)
        }));
    };

    return (
        <div className="space-y-4 pt-4 border-t border-red-900/50 mt-6">
            <h3 className="text-xl font-bold text-red-300">Price Comparison ({item.stores.length}/{MAX_STORES_PER_ITEM})</h3>

            <div className="max-h-60 overflow-y-auto pr-2 space-y-3 custom-scroll">
                {item.stores.map((store, index) => {
                    const availableOptions = getAvailableStoreOptions(index, stores, item.stores);

                    return (
                        <div key={index} className="flex flex-wrap sm:flex-nowrap items-center space-x-2 bg-black/40 p-3 rounded-xl border border-red-900/40">
                            {/* Store Name Dropdown */}
                            <select
                                value={store.storeName}
                                onChange={(e) => handleUpdateStorePrice(index, 'storeName', e.target.value)}
                                className="flex-1 w-full sm:w-auto mb-2 sm:mb-0 p-2 rounded-lg bg-red-900/60 text-white border-none focus:ring-red-400/50"
                                required
                            >
                                <option value="" disabled>Select Store</option>
                                {store.storeName && !availableOptions.find(o => o.name === store.storeName) && (
                                    <option value={store.storeName}>{store.storeName}</option>
                                )}
                                {availableOptions.map(s => (
                                    <option key={s.id} value={s.name}>{s.name}</option>
                                ))}
                            </select>

                            {/* Price Input */}
                            <input
                                type="number"
                                placeholder="Price ($)"
                                value={store.price}
                                onChange={(e) => handleUpdateStorePrice(index, 'price', e.target.value)}
                                min="0.01"
                                step="0.01"
                                className="w-28 p-2 rounded-lg bg-red-900/60 text-white border-none focus:ring-red-400/50"
                                required
                            />

                            {/* Remove Button */}
                            <button onClick={() => handleRemoveStorePrice(index)} className="w-8 h-8 p-0 flex items-center justify-center rounded-lg bg-red-600/70 hover:bg-red-500/80 transition ml-2">
                                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                            </button>
                        </div>
                    );
                })}
            </div>

            {item.stores.length < MAX_STORES_PER_ITEM && (
                <MobileButton onClick={handleAddStorePrice} className="w-full mt-4 bg-black/50 hover:bg-red-900/70 text-sm">
                    + Add Price Point
                </MobileButton>
            )}
        </div>
    );
};

const ItemForm = ({ localItem, setLocalItem, stores }) => {

    const [isScannerOpen, setIsScannerOpen] = useState(false);
    const imageInputRef = useRef(null);

    const handleImageUpload = (e) => {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onloadend = () => {
                setLocalItem(prev => ({ ...prev, imageUrl: reader.result }));
            };
            reader.readAsDataURL(file);
            e.target.value = '';
        }
    };

    const handleScanComplete = (upc) => {
        console.log(`[SCAN COMPLETE] Scanned UPC: ${upc}`);
        setLocalItem(prev => ({ ...prev, barcode: upc }));
        setIsScannerOpen(false);
    };

    const handleQuantityChange = (e) => {
        const value = parseInt(e.target.value) || 1;
        setLocalItem({ ...localItem, quantity: Math.max(1, value) });
    };

    return (
        <>
            <div className="space-y-6">
                {/* Row 1: Name and Category */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-medium text-red-300 mb-1">Item Name</label>
                        <input
                            type="text"
                            value={localItem.name}
                            onChange={(e) => setLocalItem({ ...localItem, name: e.target.value })}
                            className="w-full p-3 rounded-xl bg-black/40 text-white border border-red-900 focus:ring-red-400 focus:border-red-400"
                            required
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-red-300 mb-1">Category</label>
                        <select
                            value={localItem.category}
                            onChange={(e) => setLocalItem({ ...localItem, category: e.target.value })}
                            className="w-full p-3 rounded-xl bg-black/40 text-white border border-red-900 focus:ring-red-400 focus:border-red-400"
                        >
                            {DEFAULT_CATEGORIES.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                        </select>
                    </div>
                </div>

                {/* Row 2: Quantity and Status */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-medium text-red-300 mb-1">Quantity Needed</label>
                        <input
                            type="number"
                            min="1"
                            value={localItem.quantity}
                            onChange={handleQuantityChange}
                            className="w-full p-3 rounded-xl bg-black/40 text-white border border-red-900 focus:ring-red-400 focus:border-red-400"
                            required
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-red-300 mb-1">Status</label>
                        <div className="flex space-x-2">
                            {STATUS_OPTIONS.map(status => (
                                <button
                                    key={status.value}
                                    onClick={() => setLocalItem({ ...localItem, status: status.value })}
                                    className={`
                                    flex-1 py-2 rounded-xl text-xs font-semibold transition
                                    ${status.value === localItem.status
                                            ? status.color + ' text-black shadow-lg shadow-red-700/30'
                                            : 'bg-black/40 text-gray-300 hover:bg-red-900/50'
                                        }
                                `}
                                >
                                    {status.label}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Barcode Scanner & Image Upload */}
                <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-red-300 mb-1">Barcode / UPC</label>
                        <div className="flex space-x-2 items-center">
                            <MobileButton
                                onClick={() => setIsScannerOpen(true)}
                                className="flex-grow bg-black/50 hover:bg-red-900/70 text-sm whitespace-nowrap text-left justify-start !py-3 !px-4"
                            >
                                <span className="font-semibold text-base mr-2">
                                    {localItem.barcode ? 'UPC: ' : 'Scan Barcode'}
                                </span>
                                <span className="font-mono text-red-400 truncate">
                                    {localItem.barcode || 'Tap to Scan'}
                                </span>
                            </MobileButton>
                            {localItem.barcode && (
                                <MobileButton
                                    onClick={() => setLocalItem({ ...localItem, barcode: '' })}
                                    className="w-12 h-12 p-0 flex items-center justify-center bg-red-600/70 hover:bg-red-500/80 shadow-none flex-shrink-0"
                                    title="Clear Barcode"
                                >
                                    &times;
                                </MobileButton>
                            )}
                        </div>
                    </div>

                    {/* Image Upload */}
                    <div className="flex items-center space-x-3 bg-black/40 p-3 rounded-xl border border-red-900/40">
                        <MobileButton
                            onClick={() => imageInputRef.current && imageInputRef.current.click()}
                            className="flex-shrink-0 w-auto bg-red-700/70 hover:bg-red-600/80 text-sm whitespace-nowrap !py-2 !px-4 shadow-none"
                        >
                            Choose Image
                        </MobileButton>

                        <input
                            ref={imageInputRef}
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={handleImageUpload}
                        />

                        {localItem.imageUrl ? (
                            <img
                                src={localItem.imageUrl}
                                alt="Item Preview"
                                className="h-10 w-10 object-cover rounded-full border-2 border-red-400"
                                onError={(e) => e.target.style.display = 'none'}
                            />
                        ) : (
                            <span className="text-gray-500 text-sm">No image selected.</span>
                        )}
                    </div>
                </div>

                <StorePriceEditor item={localItem} setLocalItem={setLocalItem} stores={stores} />
            </div>

            {isScannerOpen && (
                <BarcodeScannerModal
                    onClose={() => setIsScannerOpen(false)}
                    onScanComplete={handleScanComplete}
                />
            )}
        </>
    );
};

const AddItemModal = ({ onClose, onCreate, stores }) => {
    const [localItem, setLocalItem] = useState({
        id: crypto.randomUUID(),
        name: '',
        category: DEFAULT_CATEGORIES[0],
        status: STATUS_OPTIONS[0].value,
        barcode: '',
        imageUrl: '',
        stores: [],
        quantity: 1,
    });

    const handleCreate = () => {
        if (!localItem.name.trim()) return;
        onCreate(localItem);
    };

    return (
        <Modal onClose={onClose}>
            <h2 className="text-3xl font-extrabold text-white mb-6 border-b border-red-700 pb-2">Create New Item</h2>
            <ItemForm localItem={localItem} setLocalItem={setLocalItem} stores={stores} />
            <div className="pt-6 border-t border-red-900/40 mt-4">
                <MobileButton onClick={handleCreate} disabled={!localItem.name.trim()} className="bg-red-600/90 hover:bg-red-500/90 shadow-red-700/50">
                    Add Item to List
                </MobileButton>
            </div>
        </Modal>
    );
};

const ItemEditModal = ({ item, onClose, onSave, stores }) => {
    // Deep clone the item to ensure local edits don't affect parent state until saved
    const [localItem, setLocalItem] = useState(JSON.parse(JSON.stringify(item)));

    const handleSave = () => {
        onSave(localItem);
    };

    return (
        <Modal onClose={onClose}>
            <h2 className="text-3xl font-extrabold text-white mb-6 border-b border-red-700 pb-2 truncate">Edit: {localItem.name}</h2>
            <ItemForm localItem={localItem} setLocalItem={setLocalItem} stores={stores} />
            <div className="flex justify-end space-x-4 pt-6 border-t border-red-900/40 mt-4">
                <MobileButton onClick={onClose} className="flex-1 bg-black/50 hover:bg-red-900/70 shadow-none">Cancel</MobileButton>
                <MobileButton onClick={handleSave} disabled={!localItem.name.trim()} className="flex-1 bg-red-700/90 hover:bg-red-600/90">Save Changes</MobileButton>
            </div>
        </Modal>
    );
};

const ManageStoresModal = ({ onClose, stores, handleAddStore, handleDeleteStore, newStoreName, setNewStoreName }) => (
    <Modal onClose={onClose}>
        <h2 className="text-3xl font-extrabold text-white mb-6 border-b border-red-700 pb-2">Manage Stores ({stores.length}/{MAX_REUSABLE_STORES})</h2>
        <div className="flex space-x-2 mb-4">
            <input
                type="text"
                placeholder="New Store Name"
                value={newStoreName}
                onChange={(e) => setNewStoreName(e.target.value)}
                className="flex-grow p-3 rounded-xl bg-black/40 text-white placeholder-gray-500 border border-red-900 focus:ring-red-400 focus:border-red-400"
                onKeyPress={(e) => e.key === 'Enter' && handleAddStore()}
            />
            <MobileButton onClick={handleAddStore} disabled={stores.length >= MAX_REUSABLE_STORES || !newStoreName.trim()} className={`
                w-16 flex-shrink-0 !py-2
                ${stores.length >= MAX_REUSABLE_STORES || !newStoreName.trim() ? 'bg-gray-700/50' : 'bg-red-700/70 hover:bg-red-600/80'}
            `}>
                +
            </MobileButton>
        </div>
        <div className="max-h-80 overflow-y-auto space-y-2 pr-2 custom-scroll">
            {stores.map(store => (
                <div key={store.id} className="flex justify-between items-center bg-black/40 p-3 rounded-xl border border-red-900/40">
                    <span className="text-gray-200 font-medium">{store.name}</span>
                    <button onClick={() => handleDeleteStore(store.id)} className="w-8 h-8 p-0 flex items-center justify-center rounded-lg bg-red-600/70 hover:bg-red-500/80 transition">
                        &times;
                    </button>
                </div>
            ))}
        </div>
    </Modal>
);

// --- MAIN APPLICATION COMPONENT ---

const combinedOptions = [
    {
        label: "Filter by Status",
        options: [
            { value: 'filter-all', label: 'Show All Items (Clear Filter)' },
            { value: 'filter-depleted', label: 'Show Depleted Only' },
            { value: 'filter-runninglow', label: 'Show Running Low Only' }
        ]
    },
    {
        label: "Sort By",
        options: [
            { value: 'sort-name-asc', label: 'Alphabetical (A-Z)' },
            { value: 'sort-category-asc', label: 'Category' },
            { value: 'sort-status-asc', label: 'Status (Depleted First)' },
            { value: 'sort-cheapestPrice-asc', label: 'Price Total (Cheapest First)' },
            { value: 'sort-cheapestPrice-desc', label: 'Price Total (Most Expensive First)' },
            { value: 'sort-store-asc', label: 'Cheapest Store Name' }
        ]
    }
];

const App = () => {
    // State is managed locally using React arrays, initialized with empty arrays
    const [items, setItems] = useState(initialItems);
    const [stores, setStores] = useState(initialStores);
    const [newStoreName, setNewStoreName] = useState('');
    const [editingItem, setEditingItem] = useState(null);

    // NEW: IndexedDB ready state
    const [isDbReady, setIsDbReady] = useState(false);

    // Filter State
    const [filterStatus, setFilterStatus] = useState('All'); // 'All', 'Depleted', 'Running Low'

    // Search State
    const [searchTerm, setSearchTerm] = useState('');

    // Modal Visibility State
    const [isAddItemModalOpen, setIsAddItemModalOpen] = useState(false);
    const [isManageStoresModalOpen, setIsManageStoresModalOpen] = useState(false);

    // Sorting State
    const [sortCriteria, setSortCriteria] = useState('name-asc');

    // Ref for the hidden file input
    const importInputRef = useRef(null);

    // --- EFFECT: Initialize DB and Load Data ---
    useEffect(() => {
        const loadData = async () => {
            try {
                const loadedItems = await loadAllItemsDB();
                const loadedStores = await loadAllStoresDB();
                setItems(loadedItems);
                setStores(loadedStores);
            } catch (error) {
                console.error("Failed to load initial data from IndexedDB:", error);
                // Fallback to empty state if DB fails
                setItems([]);
                setStores([]);
            } finally {
                setIsDbReady(true);
            }
        };
        loadData();
    }, []);


    // --- STORE CRUD (Modified for IndexedDB) ---

    const handleAddStore = async () => {
        if (stores.length >= MAX_REUSABLE_STORES) return;
        if (!newStoreName.trim()) return;

        const newStore = {
            id: crypto.randomUUID(),
            name: newStoreName.trim(),
        };

        try {
            await addStoreDB(newStore);
            setStores(prev => [...prev, newStore]); // Update React state only after DB success
            setNewStoreName('');
        } catch (error) {
            console.error("Failed to add store to DB:", error);
        }
    };

    const handleDeleteStore = async (storeId) => {
        try {
            await deleteStoreDB(storeId);
            setStores(prev => prev.filter(store => store.id !== storeId)); // Update React state
        } catch (error) {
            console.error("Failed to delete store from DB:", error);
        }
    };

    // --- ITEM CRUD (Modified for IndexedDB) ---

    const handleCreateItem = async (itemData) => {
        const sanitizedStores = (itemData.stores || [])
            .filter(s => s.storeName && s.price !== undefined && s.price !== null)
            .map(s => ({ ...s, price: Number(s.price) }));

        const newItem = {
            ...itemData,
            name: itemData.name.trim(),
            id: crypto.randomUUID(),
            stores: sanitizedStores,
            quantity: Math.max(1, itemData.quantity || 1)
        };
        
        try {
            await addItemDB(newItem);
            setItems(prev => [...prev, newItem]); // Update React state
            setIsAddItemModalOpen(false);
        } catch (error) {
            console.error("Failed to create item in DB:", error);
        }
    };

    const handleUpdateItem = async (updatedItem) => {
        const sanitizedStores = (updatedItem.stores || [])
            .filter(s => s.storeName && s.price !== undefined && s.price !== null)
            .map(s => ({ ...s, price: Number(s.price) }));

        const itemToSave = {
            ...updatedItem,
            name: updatedItem.name.trim(),
            stores: sanitizedStores,
            quantity: Math.max(1, updatedItem.quantity || 1)
        };

        try {
            await updateItemDB(itemToSave);
            setItems(prev => prev.map(item => item.id === itemToSave.id ? itemToSave : item)); // Update React state
            setEditingItem(null);
        } catch (error) {
            console.error("Failed to update item in DB:", error);
        }
    };

    const handleDeleteItem = async (itemId) => {
        try {
            await deleteItemDB(itemId);
            setItems(prev => prev.filter(item => item.id !== itemId)); // Update React state
        } catch (error) {
            console.error("Failed to delete item from DB:", error);
        }
    };

    const handleUpdateQuantity = async (itemId, delta) => {
        const updatedItems = items.map(item => {
            if (item.id === itemId) {
                const newQuantity = Math.max(1, item.quantity + delta);
                return { ...item, quantity: newQuantity };
            }
            return item;
        });

        const itemToUpdate = updatedItems.find(i => i.id === itemId);

        if (itemToUpdate) {
            try {
                await updateItemDB(itemToUpdate);
                setItems(updatedItems); // Update React state
            } catch (error) {
                console.error("Failed to update quantity in DB:", error);
            }
        }
    };

    // --- Status Cycling Logic (Modified for IndexedDB) ---
    const handleCycleStatus = async (itemId) => {
        const updatedItems = items.map(item => {
            if (item.id === itemId) {
                const currentIndex = STATUS_CYCLE.indexOf(item.status);
                const nextIndex = (currentIndex + 1) % STATUS_CYCLE.length;
                const newStatus = STATUS_CYCLE[nextIndex];
                return { ...item, status: newStatus };
            }
            return item;
        });

        const itemToUpdate = updatedItems.find(i => i.id === itemId);

        if (itemToUpdate) {
            try {
                await updateItemDB(itemToUpdate);
                setItems(updatedItems); // Update React state
            } catch (error) {
                console.error("Failed to cycle status in DB:", error);
            }
        }
    };

    // --- UNIFIED FILTER/SORT LOGIC (Unchanged) ---

    const selectedValue = useMemo(() => {
        if (filterStatus === 'Depleted') return 'filter-depleted';
        if (filterStatus === 'Running Low') return 'filter-runninglow';

        return `sort-${sortCriteria}`;
    }, [filterStatus, sortCriteria]);


    const handleCombinedChange = (e) => {
        const value = e.target.value;

        if (value.startsWith('filter-')) {
            const statusSuffix = value.substring(7);

            if (statusSuffix === 'all') {
                setFilterStatus('All');
            } else if (statusSuffix === 'depleted') {
                setFilterStatus('Depleted');
            } else if (statusSuffix === 'runninglow') {
                setFilterStatus('Running Low');
            }

        } else if (value.startsWith('sort-')) {
            const criteria = value.substring(5);
            setSortCriteria(criteria);
            setFilterStatus('All');
        }
    };

    // --- LOGIC & HELPERS (Unchanged) ---

    const getCheapestOption = (item) => {
        if (!item.stores || item.stores.length === 0) return { price: null, storeName: 'N/A' };

        const validPrices = item.stores.filter(s => s.price > 0);
        if (validPrices.length === 0) return { price: null, storeName: 'N/A' };

        const cheapest = validPrices.reduce((min, current) => {
            return (current.price < min.price) ? current : min;
        }, validPrices[0]);

        return {
            price: cheapest.price,
            storeName: cheapest.storeName,
        };
    };

    // Filter and Sort Logic
    const filteredAndSortedItems = useMemo(() => {
        let filtered = items;
        const lowerCaseSearchTerm = searchTerm.toLowerCase().trim();

        // 1. FILTERING (Search Term)
        if (lowerCaseSearchTerm) {
            filtered = filtered.filter(item =>
                item.name.toLowerCase().includes(lowerCaseSearchTerm)
            );
        }

        // 2. FILTERING (Status)
        if (filterStatus === 'Depleted') {
            filtered = filtered.filter(item => item.status === 'Depleted');
        } else if (filterStatus === 'Running Low') {
            filtered = filtered.filter(item => item.status === 'Running Low');
        }

        // 3. SORTING
        let sorted = [...filtered];
        const [criteria, directionStr] = sortCriteria.split('-');
        const direction = directionStr === 'asc' ? 1 : -1;

        sorted.sort((a, b) => {
            let aValue, bValue;

            switch (criteria) {
                case 'name':
                case 'category':
                    aValue = a[criteria].toLowerCase();
                    bValue = b[criteria].toLowerCase();
                    if (aValue < bValue) return -1 * direction;
                    if (aValue > bValue) return 1 * direction;
                    return 0;
                case 'status':
                    const statusOrder = { 'Depleted': 1, 'Running Low': 2, 'Home Stocked': 3 };
                    return (statusOrder[a.status] - statusOrder[b.status]) * direction;
                case 'cheapestPrice':
                    // Compare based on Total Estimated Cost: (Price * Quantity)
                    aValue = (getCheapestOption(a).price || Infinity) * (a.quantity || 1);
                    bValue = (getCheapestOption(b).price || Infinity) * (b.quantity || 1);
                    return (aValue - bValue) * direction;
                case 'store':
                    aValue = getCheapestOption(a).storeName.toLowerCase();
                    bValue = getCheapestOption(b).storeName.toLowerCase();
                    if (aValue < bValue) return -1 * direction;
                    if (aValue > bValue) return 1 * direction;
                    return 0;
                default:
                    return 0;
            }
        });
        return sorted;
    }, [items, sortCriteria, filterStatus, searchTerm]); // Dependency on searchTerm added

    const totalVisibleItemCount = filteredAndSortedItems.length;

    // Calculate Total Estimated Cost based on visible (filtered/sorted) items
    const totalEstimatedCost = useMemo(() => {
        return filteredAndSortedItems.reduce((total, item) => {
            const cheapest = getCheapestOption(item);
            return total + (cheapest.price || 0) * (item.quantity || 1);
        }, 0);
    }, [filteredAndSortedItems]);


    // --- IMPORT / EXPORT LOGIC (Export unchanged, Import modified to update DB) ---
    const handleExportData = () => {
        if (items.length === 0) {
            console.warn("Export attempted with no items.");
            return;
        }
        const data = {
            items: items,
            stores: stores,
            timestamp: new Date().toISOString()
        };
        const jsonString = JSON.stringify(data, null, 2);
        const blob = new Blob([jsonString], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `price_scout_export_${new Date().toLocaleDateString().replace(/\//g, '-')}.json`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    };

    const handleImportData = (event) => {
        const file = event.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = async (e) => { // Made async to await DB operations
            try {
                const result = e.target.result;
                if (typeof result !== 'string') {
                    throw new Error("File content is not a string.");
                }
                const importedData = JSON.parse(result);

                if (!importedData || !Array.isArray(importedData.items) || !Array.isArray(importedData.stores)) {
                    throw new Error("Invalid file structure. Must contain 'items' (array) and 'stores' (array) keys.");
                }

                const sanitizedItems = importedData.items.map(item => ({
                    ...item,
                    quantity: Math.max(1, item.quantity || 1)
                }));

                const sanitizedStores = importedData.stores.slice(0, MAX_REUSABLE_STORES);

                // --- Update IndexedDB with imported data ---
                await executeDBTransaction(ITEM_STORE, 'readwrite', (store) => {
                    store.clear();
                    sanitizedItems.forEach(item => store.add(item));
                });
                await executeDBTransaction(STORE_STORE, 'readwrite', (store) => {
                    store.clear();
                    sanitizedStores.forEach(storeItem => store.add(storeItem));
                });
                // ------------------------------------------

                setItems(sanitizedItems);
                setStores(sanitizedStores);

                console.log("Data imported successfully! Items: %d, Stores: %d", sanitizedItems.length, sanitizedStores.length);
                event.target.value = '';
            } catch (error) {
                console.error("Error importing data:", error.message);
                event.target.value = '';
            }
        };
        reader.onerror = () => {
            console.error("FileReader failed to read file.");
            event.target.value = '';
        };
        reader.readAsText(file);
    };

    // Show a loading screen until IndexedDB has loaded the initial data
    if (!isDbReady) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-black/80 text-white">
                <div className="flex flex-col items-center">
                    <svg className="animate-spin h-8 w-8 text-red-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    <p className="mt-4 text-gray-400">Loading data from local storage...</p>
                </div>
            </div>
        );
    }

    // --- RENDER ---
    return (
        <div className="min-h-screen p-4 pb-20 text-white bg-fixed bg-cover font-sans custom-scroll" style={{
            backgroundImage: 'linear-gradient(145deg, #0a0a0a 0%, #1a0000 50%, #0a0a0a 100%)',
        }}>
            {/* Custom Scrollbar Style for the App */}
            <style jsx="true">{`
                .custom-scroll::-webkit-scrollbar { width: 6px; }
                .custom-scroll::-webkit-scrollbar-thumb { background: #DC2626; border-radius: 3px; }
                .custom-scroll::-webkit-scrollbar-track { background: #1F2937; }
                .text-shadow-red { text-shadow: 0 0 5px rgba(220, 38, 38, 0.7); }
            `}</style>

            {/* Header */}
            <header className="mb-6 pt-2">
                <div className="flex justify-between items-center flex-wrap gap-3">
                    <h1 className="text-2xl font-black bg-clip-text text-transparent bg-gradient-to-r from-red-400 to-white tracking-wide text-shadow-red">
                        MyEssentials Ledger
                    </h1>
                    {items.length === 0 ? (
                        <MobileButton
                            onClick={() => importInputRef.current && importInputRef.current.click()}
                            className="w-full sm:w-auto flex-shrink-0 !py-2 bg-red-600/90 hover:bg-red-500/90 shadow-red-700/50"
                        >
                            Import Data
                        </MobileButton>
                    ) : (
                        <MobileButton onClick={handleExportData} className="w-full sm:w-auto flex-shrink-0 !py-2 bg-red-600/90 hover:bg-red-500/90 shadow-red-700/50">
                            Export Data
                        </MobileButton>
                    )}
                    <input
                        ref={importInputRef}
                        type="file"
                        accept=".json"
                        className="hidden"
                        onChange={handleImportData}
                    />
                </div>

                {/* STATS BAR */}
                <DeepCard className="mt-4 p-4 !rounded-2xl">
                    <div className="grid grid-cols-2 gap-4 text-center">
                        <div className="border-r border-red-900/50 pr-4">
                            <span className="block text-2xl sm:text-3xl font-extrabold text-red-300">
                                {totalVisibleItemCount}
                            </span>
                            <span className="block text-xs uppercase font-medium text-gray-400">Items Visible</span>
                        </div>
                        <div className="pl-4">
                            <span className="block text-2xl sm:text-3xl font-extrabold text-green-400">
                                ${totalEstimatedCost.toFixed(2)}
                            </span>
                            <span className="block text-xs uppercase font-medium text-gray-400">Estimated Total</span>
                        </div>
                    </div>
                </DeepCard>
            </header>

            {/* ACTION & FILTER BAR */}
            <DeepCard className="mb-6 p-4 flex flex-col justify-start items-start gap-4 !rounded-2xl">

                {/* COMBINED SEARCH AND FILTER/SORT CONTAINER */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 w-full">
                    {/* SEARCH INPUT */}
                    <div>
                        <label htmlFor="search-input" className="block text-sm font-semibold text-red-300 mb-1">Search Items:</label>
                        <div className="relative">
                            <input
                                id="search-input"
                                type="text"
                                placeholder="Search by item name..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                // Added padding-right (pr-10) to accommodate the clear button
                                className="w-full p-3 rounded-xl bg-black/40 text-white placeholder-gray-500 border border-red-900 focus:ring-red-400 focus:border-red-400 pr-10"
                            />

                            {/* Clear Button (Conditional) */}
                            {searchTerm && (
                                <button
                                    onClick={() => setSearchTerm('')}
                                    title="Clear Search"
                                    // Positions the button absolute to the right of the input field
                                    className="absolute inset-y-0 right-0 flex items-center pr-3 text-red-400 hover:text-red-300 transition"
                                >
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path>
                                    </svg>
                                </button>
                            )}
                        </div>
                    </div>

                    {/* UNIFIED SORT/FILTER DROPDOWN */}
                    <div>
                        <label htmlFor="combined-select" className="block text-sm font-semibold text-red-300 mb-1">Filter/Sort:</label>
                        <select
                            id="combined-select"
                            value={selectedValue}
                            onChange={handleCombinedChange}
                            className="w-full p-3 rounded-xl bg-black/40 text-white border border-red-900 focus:ring-red-400 focus:border-red-400"
                        >
                            {combinedOptions.map((group) => (
                                <optgroup key={group.label} label={group.label}>
                                    {group.options.map((option) => (
                                        <option key={option.value} value={option.value}>
                                            {option.label}
                                        </option>
                                    ))}
                                </optgroup>
                            ))}
                        </select>
                    </div>
                    {/* Import/Export/Manage Stores Buttons */}
                    <div className="flex w-full sm:w-auto space-x-2 py-3">
                        <MobileButton onClick={() => setIsManageStoresModalOpen(true)} className="flex-1 !py-3 bg-black/50 hover:bg-red-900/70 text-xs sm:text-sm shadow-none">
                            Stores ({stores.length})
                        </MobileButton>

                        <MobileButton
                            onClick={() => setIsAddItemModalOpen(true)}
                            className="flex-1 !py-3 bg-black/50 hover:bg-red-900/70 text-xs sm:text-sm shadow-none"
                        >
                            + New Item
                        </MobileButton>

                    </div>
                </div>

            </DeepCard>

            {/* MAIN ITEM LIST */}
            <DeepCard className="p-0 overflow-hidden">
                <div className="min-w-full overflow-x-auto">
                    <table className="min-w-full divide-y divide-red-900/40">
                        <thead className="bg-red-900/50">
                            <tr>
                                <th className="px-4 py-3 text-left text-xs font-semibold text-white uppercase tracking-wider min-w-[120px]">Item</th>
                                <th className="px-4 py-3 text-left text-xs font-semibold text-white uppercase tracking-wider min-w-[80px] hidden sm:table-cell">Category</th>
                                <th className="px-4 py-3 text-left text-xs font-semibold text-white uppercase tracking-wider min-w-[80px]">Status</th>
                                <th className="px-4 py-3 text-center text-xs font-semibold text-white uppercase tracking-wider min-w-[100px]">Qty Needed</th>
                                <th className="px-4 py-3 text-left text-xs font-semibold text-green-400 uppercase tracking-wider min-w-[120px]">Cheapest Price</th>
                                <th className="px-4 py-3 text-right text-xs font-semibold text-white uppercase tracking-wider min-w-[60px]"></th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-red-900/30">
                            {totalVisibleItemCount === 0 && (
                                <tr>
                                    <td colSpan="6" className="px-6 py-10 text-center text-lg text-gray-400">
                                        {filterStatus === 'All' && searchTerm === '' ? 'Your list is empty. Tap "+ New Item" to start.' : `No items match the current search or filter.`}
                                    </td>
                                </tr>
                            )}
                            {filteredAndSortedItems.map(item => {
                                const status = STATUS_OPTIONS.find(s => s.value === item.status) || STATUS_OPTIONS[0];
                                const cheapest = getCheapestOption(item);
                                const totalCost = (cheapest.price || 0) * (item.quantity || 1);

                                return (
                                    <tr key={item.id} className="bg-black/20 hover:bg-black/40 transition duration-150">

                                        {/* Item Name & Image */}
                                        <td className="px-4 py-3 whitespace-nowrap font-medium text-white text-sm">
                                            <div className="flex items-center space-x-2">
                                                {item.imageUrl && (
                                                    <img
                                                        src={item.imageUrl}
                                                        alt={item.name}
                                                        className="h-8 w-8 rounded-full flex-shrink-0 object-cover border border-red-700/50"
                                                        onError={(e) => e.target.style.display = 'none'}
                                                    />
                                                )}
                                                <div className="flex flex-col">
                                                    <span className="font-semibold truncate w-60">{item.name}</span>
                                                    <span className="text-xs text-gray-500 block sm:hidden">{item.category}</span>
                                                </div>
                                            </div>
                                        </td>

                                        {/* Category (Hidden on Mobile) */}
                                        <td className="px-4 py-3 whitespace-nowrap text-xs text-gray-400 hidden sm:table-cell">{item.category}</td>

                                        {/* Status */}
                                        <td
                                            className="px-4 py-3 whitespace-nowrap cursor-pointer hover:opacity-80 transition duration-150"
                                            onClick={() => handleCycleStatus(item.id)}
                                            title="Click to cycle status"
                                        >
                                            <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold text-black ${status.color}`}>
                                                <span className={`w-2 h-2 rounded-full mr-2 ${status.dot}`}></span>
                                                {status.label}
                                            </span>
                                        </td>

                                        {/* Quantity Controls */}
                                        <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-300 text-center">
                                            <div className="flex items-center justify-center space-x-1">
                                                <QuantityButton
                                                    onClick={() => handleUpdateQuantity(item.id, -1)}
                                                    disabled={item.quantity <= 1}
                                                    className="bg-red-700/70"
                                                >
                                                    -
                                                </QuantityButton>
                                                <span className="font-bold text-lg w-6 text-center text-red-300">{item.quantity}</span>
                                                <QuantityButton
                                                    onClick={() => handleUpdateQuantity(item.id, 1)}
                                                    className="bg-green-700/70"
                                                >
                                                    +
                                                </QuantityButton>
                                            </div>
                                        </td>

                                        {/* Estimated Cost (Total) & Store */}
                                        <td className="px-4 py-3 whitespace-nowrap text-sm font-semibold">
                                            <div className="flex flex-col">
                                                <span className="text-green-400">${totalCost.toFixed(2)}</span>
                                                <span className="text-xs text-gray-500 truncate" title={cheapest.storeName}>@{cheapest.storeName}</span>
                                            </div>
                                        </td>

                                        {/* Actions */}
                                        <td className="px-4 py-3 whitespace-nowrap text-right text-sm font-medium">
                                            <ActionDropdown
                                                onEdit={() => setEditingItem(item)}
                                                onDelete={() => handleDeleteItem(item.id)}
                                            />
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </DeepCard>

            {/* Modals */}
            {isAddItemModalOpen && (
                <AddItemModal
                    onClose={() => setIsAddItemModalOpen(false)}
                    onCreate={handleCreateItem}
                    stores={stores}
                />
            )}

            {isManageStoresModalOpen && (
                <ManageStoresModal
                    onClose={() => setIsManageStoresModalOpen(false)}
                    stores={stores}
                    handleAddStore={handleAddStore}
                    handleDeleteStore={handleDeleteStore}
                    newStoreName={newStoreName}
                    setNewStoreName={setNewStoreName}
                />
            )}

            {editingItem && (
                <ItemEditModal
                    item={editingItem}
                    onClose={() => setEditingItem(null)}
                    onSave={handleUpdateItem}
                    stores={stores}
                />
            )}
        </div>
    );
};

export default App;