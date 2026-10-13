// Ultimate Order Intelligence Dossier
import React, { useState, useEffect, useRef } from 'react';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import { useSettings } from '@core/context/SettingsContext';
import { useParams, useNavigate } from 'react-router-dom';
import Card from '@shared/components/ui/Card';
import Badge from '@shared/components/ui/Badge';
import Modal from '@shared/components/ui/Modal';
import { adminApi } from '../services/adminApi';
import {
    ChevronLeft,
    Box,
    Truck,
    User,
    Building2,
    Calendar,
    Clock,
    ShoppingBag,
    Printer,
    Download,
    Mail,
    Phone,
    Copy,
    CreditCard,
    AlertCircle,
    Package,
    Navigation,
    Store,
    Info,
    MapPin
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@shared/components/ui/Toast';

const OrderDetail = () => {
    const { orderId } = useParams();
    const navigate = useNavigate();
    const { showToast } = useToast();
    const { settings } = useSettings();
    const [order, setOrder] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [showAssignModal, setShowAssignModal] = useState(false);
    const [eligibilityData, setEligibilityData] = useState(null);
    const [isEvaluating, setIsEvaluating] = useState(false);
    const [isAssigning, setIsAssigning] = useState(false);
    const invoiceRef = useRef(null);

    const fetchDetail = async () => {
        setIsLoading(true);
        try {
            const response = await adminApi.getOrderDetails(orderId);
            if (response.data.success) {
                setOrder(response.data.result);
            }
        } catch (error) {
            showToast("Failed to load order details", "error");
        } finally {
            setIsLoading(false);
        }
    };

    const handleStatusUpdate = async (newStatus) => {
        try {
            await adminApi.updateOrderStatus(orderId, { status: newStatus });
            showToast(`Order status updated to ${newStatus}`, "success");
            fetchDetail(); // Refresh data
        } catch (error) {
            console.error("Failed to update status:", error);
            showToast("Failed to update status", "error");
        }
    };

    const handleShiprocketCreateAdmin = async () => {
        try {
            const res = await adminApi.createShipment({
                orderId: order.orderId,
                preferredProvider: "shiprocket",
            });
            if (res.data?.success) {
                showToast(`Shiprocket AWB #${res.data?.result?.externalId || "Generated"} Created!`, "success");
                fetchDetail();
            } else {
                showToast(res.data?.message || "Shipment creation failed", "error");
            }
        } catch (err) {
            console.error("Shiprocket shipment creation error:", err);
            showToast(err.response?.data?.message || "Failed to connect to Shiprocket service", "error");
        }
    };

    const handleOpenAssignModal = async () => {
        setShowAssignModal(true);
        setIsEvaluating(true);
        try {
            const targetId = order?._id || orderId;
            const res = await adminApi.getWarehouseEligibility(targetId);
            if (res.data.success) {
                setEligibilityData(res.data.result);
            }
        } catch (err) {
            console.error("Warehouse eligibility evaluation error:", err);
            showToast(err.response?.data?.message || "Failed to evaluate warehouse eligibility", "error");
        } finally {
            setIsEvaluating(false);
        }
    };

    const handleAssignWarehouse = async (warehouseId) => {
        setIsAssigning(true);
        try {
            const targetId = order?._id || orderId;
            const res = await adminApi.assignWarehouse(targetId, { warehouseId, force: true });
            if (res.data.success) {
                showToast("Order assigned to warehouse successfully", "success");
                setShowAssignModal(false);
                fetchDetail();
            } else {
                showToast(res.data.message || "Assignment failed", "error");
            }
        } catch (err) {
            showToast(err.response?.data?.message || "Failed to assign warehouse", "error");
        } finally {
            setIsAssigning(false);
        }
    };

    useEffect(() => {
        if (orderId) {
            fetchDetail();
        }
    }, [orderId]);

    const getStatusStyles = (status) => {
        switch (status.toLowerCase()) {
            case 'pending': return 'bg-amber-100 text-amber-600 border-amber-200';
            case 'confirmed': return 'bg-brand-100 text-brand-600 border-brand-200';
            case 'packed': return 'bg-brand-100 text-brand-600 border-brand-200';
            case 'out_for_delivery': return 'bg-purple-100 text-purple-600 border-purple-200';
            case 'delivered': return 'bg-brand-100 text-brand-600 border-brand-200';
            case 'cancelled': return 'bg-rose-100 text-rose-600 border-rose-200';
            default: return 'bg-slate-100 text-slate-600 border-slate-200';
        }
    };

    const copyToClipboard = (text, label) => {
        if (!text) return;
        navigator.clipboard.writeText(text);
        showToast(`${label} copied to internal clipboard`, 'success');
    };

    const handlePrintInvoice = async () => {
        const element = invoiceRef.current;
        if (!element) return;
        
        showToast("Generating PDF Invoice...", "info");
        
        try {
            const canvas = await html2canvas(element, {
                scale: 2,
                useCORS: true,
                logging: false,
                backgroundColor: "#ffffff",
                width: 794,
                windowWidth: 794,
                scrollX: 0,
                scrollY: 0,
                onclone: (clonedDoc) => {
                    /** @type {any} */
                    const clonedRoot = clonedDoc.querySelector('[data-invoice-root]');
                    if (clonedRoot) {
                        clonedRoot.style.width = '794px';
                        clonedRoot.style.minWidth = '794px';
                        clonedRoot.style.maxWidth = '794px';
                        clonedRoot.style.display = 'block';
                        clonedRoot.style.position = 'static';
                        clonedRoot.style.margin = '0 auto';
                    }
                    /** @type {any} */
                    const clonedParent = clonedRoot?.parentElement;
                    if (clonedParent) {
                        clonedParent.style.position = 'static';
                        clonedParent.style.left = '0';
                    }

                    // Forcefully remove any elements or styles that might use oklch
                    // html2canvas crashes when it encounters oklch color functions in stylesheets
                    const styleSheets = clonedDoc.styleSheets;
                    for (let i = 0; i < styleSheets.length; i++) {
                        try {
                            const rules = styleSheets[i].cssRules || styleSheets[i].rules;
                            for (let j = rules.length - 1; j >= 0; j--) {
                                if (rules[j].cssText && rules[j].cssText.includes('oklch')) {
                                    styleSheets[i].deleteRule(j);
                                }
                            }
                        } catch (e) {
                            // Skip cross-origin stylesheets that we can't access
                        }
                    }
                    
                    // Also explicitly reset root variables just in case
                    const style = clonedDoc.createElement('style');
                    style.innerHTML = `
                        :root {
                            --primary: #15803d !important;
                            --secondary: #64748b !important;
                            --background: #ffffff !important;
                            --foreground: #0f172a !important;
                        }
                    `;
                    clonedDoc.head.appendChild(style);
                }
            });
            const imgData = canvas.toDataURL('image/png');
            const pdf = new jsPDF({
                orientation: 'portrait',
                unit: 'mm',
                format: 'a4'
            });
            const pdfWidth = 210;
            const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
            
            if (pdfHeight <= 297) {
                pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight, undefined, 'FAST');
            } else {
                let heightLeft = pdfHeight;
                let position = 0;
                pdf.addImage(imgData, 'PNG', 0, position, pdfWidth, pdfHeight, undefined, 'FAST');
                heightLeft -= 297;
                while (heightLeft > 0) {
                    position = heightLeft - pdfHeight;
                    pdf.addPage();
                    pdf.addImage(imgData, 'PNG', 0, position, pdfWidth, pdfHeight, undefined, 'FAST');
                    heightLeft -= 297;
                }
            }
            pdf.save(`Invoice_${order.orderId || 'Order'}.pdf`);
            showToast("Invoice downloaded successfully", "success");
        } catch (error) {
            console.error("PDF generation failed:", error);
            showToast("Failed to generate PDF", "error");
        }
    };

    if (isLoading) {
        return (
            <div className="min-h-[400px] flex flex-col items-center justify-center gap-4">
                <div className="h-12 w-12 border-4 border-fuchsia-600 border-t-transparent rounded-full animate-spin"></div>
                <p className="text-xs font-black text-slate-400 uppercase tracking-[4px]">Accessing Intelligence...</p>
            </div>
        );
    }

    if (!order) {
        return (
            <div className="min-h-[400px] flex flex-col items-center justify-center gap-4 text-center p-8">
                <AlertCircle className="h-16 w-16 text-rose-200" />
                <h2 className="text-xl font-black text-slate-900 uppercase">Order Node Not Found</h2>
                <button onClick={() => navigate(-1)} className="ds-btn ds-btn-md bg-slate-900 text-white mt-4">Return to List</button>
            </div>
        );
    }

    return (
        <div className="ds-section-spacing animate-in fade-in slide-in-from-bottom-4 duration-700 pb-12">
            {/* Control Bar */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 px-1">
                <div className="flex items-center gap-4">
                    <button
                        onClick={() => navigate(-1)}
                        className="p-3 bg-white ring-1 ring-slate-200 rounded-2xl hover:bg-slate-50 transition-all text-slate-400 group"
                    >
                        <ChevronLeft className="h-5 w-5 group-hover:-translate-x-1 transition-transform" />
                    </button>
                    <div>
                        <div className="flex items-center gap-3">
                            <h1 className="text-2xl font-black text-slate-900 uppercase tracking-tight">Order #{order.orderId}</h1>
                            <div className="relative inline-block w-44">
                                <select
                                    value={order.status}
                                    onChange={(e) => handleStatusUpdate(e.target.value)}
                                    className={cn(
                                        "w-full text-[10px] pl-3 pr-8 py-1.5 rounded-xl font-black uppercase tracking-widest border appearance-none cursor-pointer focus:ring-2 focus:ring-offset-1 transition-all outline-none shadow-sm",
                                        getStatusStyles(order.status)
                                    )}
                                >
                                    <option value="pending">Pending</option>
                                    <option value="confirmed">Confirmed</option>
                                    <option value="packed">Packed</option>
                                    <option value="out_for_delivery">Out for Delivery</option>
                                    <option value="delivered">Delivered</option>
                                    <option value="cancelled">Cancelled</option>
                                </select>
                                <Info className="absolute right-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 pointer-events-none opacity-60" />
                            </div>
                        </div>
                        <p className="text-[11px] font-bold text-slate-400 mt-1 uppercase tracking-widest flex items-center gap-2">
                            <Calendar className="h-3.5 w-3.5" />
                            {new Date(order.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' })} • <Clock className="h-3.5 w-3.5 ml-1" /> {new Date(order.createdAt).toLocaleTimeString()}
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    <button 
                        onClick={handlePrintInvoice}
                        className="flex items-center gap-2 px-5 py-3 bg-white ring-1 ring-slate-200 text-slate-700 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-50 transition-all shadow-sm"
                    >
                        <Printer className="h-4 w-4 text-slate-400" />
                        Print Invoice
                    </button>
                </div>

            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Left Column */}
                <div className="lg:col-span-2 space-y-6">
                    {/* Items Section */}
                    <Card className="border-none shadow-xl ring-1 ring-slate-100 bg-white rounded-xl overflow-hidden">
                        <div className="p-6 border-b border-slate-50 bg-slate-50/30 flex items-center justify-between">
                            <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest flex items-center gap-3">
                                <Box className="h-4 w-4 text-brand-500" />
                                Items in Order
                            </h3>
                            <Badge className="bg-brand-50 text-brand-700 border-none text-[9px] font-black">{order.items.length} ITEMS</Badge>
                        </div>
                        <div className="p-0 overflow-x-auto">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="bg-slate-50/50">
                                        <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Product Node</th>
                                        <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Unit Price</th>
                                        <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Qty</th>
                                        <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Aggregate</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-50">
                                    {order.items.map((item) => (
                                        <tr key={item._id} className="group hover:bg-slate-50/30 transition-all">
                                            <td className="px-6 py-5">
                                                <div className="flex items-center gap-4">
                                                    <div className="h-14 w-14 bg-slate-50 rounded-2xl flex items-center justify-center ds-h1 shadow-inner border border-slate-100 group-hover:scale-110 transition-transform overflow-hidden">
                                                        {item.image ? (
                                                            <img src={item.image} alt="" className="w-full h-full object-cover" />
                                                        ) : (
                                                            <Package className="h-6 w-6 text-slate-200" />
                                                        )}
                                                    </div>
                                                    <div>
                                                        <h4 className="text-sm font-black text-slate-900">{item.name}</h4>
                                                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">ID: {item.product?._id || item.product}</p>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-6 py-5 text-center text-sm font-bold text-slate-600">₹{item.price}</td>
                                            <td className="px-6 py-5 text-center">
                                                <span className="bg-slate-100 px-3 py-1 rounded-lg text-xs font-black text-slate-700">x{item.quantity}</span>
                                            </td>
                                            <td className="px-6 py-5 text-right text-sm font-black text-slate-900">₹{item.price * item.quantity}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                        <div className="p-4 bg-slate-50/50 flex flex-col items-end gap-3 text-right">
                            <div className="flex items-center justify-between w-full max-w-[240px]">
                                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Subtotal</span>
                                <span className="text-sm font-black text-slate-700">₹{order.pricing?.subtotal || 0}</span>
                            </div>
                            <div className="flex items-center justify-between w-full max-w-[240px]">
                                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Delivery Fee</span>
                                <span className="text-sm font-bold text-brand-600">₹{order.pricing?.deliveryFee || 0}</span>
                            </div>
                            <div className="h-px w-full max-w-[240px] bg-slate-200 my-2" />
                            <div className="flex items-center justify-between w-full max-w-[240px]">
                                <span className="text-xs font-black text-slate-900 uppercase tracking-tight">Total Payable</span>
                                <span className="text-2xl font-black text-fuchsia-600">₹{order.pricing?.total || 0}</span>
                            </div>
                        </div>
                    </Card>

                    {/* Warehouse Node & Fulfillment State */}
                    <Card className="border-none shadow-xl ring-1 ring-slate-100 bg-white rounded-2xl p-6">
                        <div className="flex items-center justify-between mb-6">
                            <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                                <Building2 className="h-4 w-4 text-primary" />
                                Fulfillment Warehouse Node
                            </h4>
                            <Badge
                                variant={order.warehouseId || order.warehouse ? "success" : "warning"}
                                className="text-[9px] font-black uppercase"
                            >
                                {order.warehouseAssignmentStatus || (order.warehouseId ? "ASSIGNED" : "UNASSIGNED")}
                            </Badge>
                        </div>
                        <div className="flex items-center justify-between gap-4">
                            <div className="flex items-center gap-4">
                                <div className="h-16 w-16 bg-blue-50 rounded-2xl flex items-center justify-center font-black text-primary text-xl">
                                    <Building2 className="h-8 w-8 text-primary" />
                                </div>
                                <div className="text-left">
                                    <h3 className="text-lg font-black text-slate-900 leading-tight">
                                        {(typeof order.warehouse === 'object' && (order.warehouse?.warehouseName || order.warehouse?.name)) ||
                                         (typeof order.warehouseId === 'object' && (order.warehouseId?.warehouseName || order.warehouseId?.name)) ||
                                         order.assignedWarehouse?.warehouseName ||
                                         (order.warehouseId ? "Assigned Warehouse" : "No Warehouse Assigned")}
                                    </h3>
                                    <p className="text-xs font-bold text-slate-500">
                                        {(typeof order.warehouse === 'object' && order.warehouse?.city)
                                            ? `Hub: ${order.warehouse.city}${order.warehouse.pincode ? ` - ${order.warehouse.pincode}` : ''}`
                                            : (typeof order.warehouseId === 'object' && order.warehouseId?.city)
                                                ? `Hub: ${order.warehouseId.city}${order.warehouseId.pincode ? ` - ${order.warehouseId.pincode}` : ''}`
                                                : "Physical fulfillment warehouse node"}
                                    </p>
                                    {order.warehouseAssignedAt && (
                                        <p className="text-[10px] font-bold text-slate-400 mt-0.5">
                                            Assigned: {new Date(order.warehouseAssignedAt).toLocaleString()}
                                        </p>
                                    )}
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={handleOpenAssignModal}
                                className="px-4 py-2 bg-primary hover:bg-primary/90 text-white font-bold text-xs rounded-xl shadow-sm transition-all"
                            >
                                {order.warehouseId ? "Reassign Hub" : "Assign Warehouse"}
                            </button>
                        </div>
                    </Card>

                    {/* Shop Details */}
                    <Card className="border-none shadow-xl ring-1 ring-slate-100 bg-white rounded-2xl p-6">
                        <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-6 flex items-center gap-2">
                            <Store className="h-4 w-4" />
                            Shop Node Information
                        </h4>
                        <div className="flex items-center gap-4">
                            <div className="h-16 w-16 bg-orange-50 rounded-2xl flex items-center justify-center ds-h2 font-black text-orange-600 uppercase">
                                {order.seller?.shopName?.[0] || 'S'}
                            </div>
                            <div className="text-left">
                                <h3 className="text-lg font-black text-slate-900 leading-tight">{order.seller?.shopName || 'Unknown Shop'}</h3>
                                <p className="text-xs font-bold text-brand-600 uppercase tracking-tighter">Verified Anchor Partner</p>
                                <p className="text-[10px] font-bold text-slate-400 mt-1 uppercase tracking-widest">OWNER: {order.seller?.name}</p>
                            </div>
                        </div>
                    </Card>

                    {/* Logistical Nodes */}
                    <Card className="border-none shadow-xl ring-1 ring-slate-100 bg-white rounded-xl p-6">
                        <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest mb-8 flex items-center gap-3">
                            <Navigation className="h-4 w-4 text-brand-500" />
                            Logistical Real-time State
                        </h3>
                        <div className="space-y-6 relative ml-4">
                            <div className="absolute top-0 bottom-0 left-[7.5px] w-0.5 bg-slate-100" />
                            <div className="flex gap-6 relative">
                                <div className="h-4 w-4 rounded-full ring-4 ring-white z-10 mt-1 bg-brand-500 shadow-lg shadow-brand-200" />
                                <div className="flex-1 pb-4">
                                    <div className="flex items-center justify-between mb-1">
                                        <h4 className="text-xs font-black uppercase tracking-tight text-slate-900">
                                            Status: {order.status.replace(/_/g, ' ')}
                                        </h4>
                                        <span className="text-[10px] font-bold text-slate-400 uppercase">{new Date(order.updatedAt).toLocaleTimeString()}</span>
                                    </div>
                                    <p className="text-[11px] font-bold text-slate-400 leading-relaxed italic">"System verified current logistical state as {order.status}."</p>
                                </div>
                            </div>
                        </div>
                    </Card>
                    {/* Shiprocket Delivery Integration Card */}
                    <Card className="border-none shadow-xl ring-1 ring-purple-100 bg-gradient-to-br from-purple-50/40 via-white to-indigo-50/20 rounded-xl p-6">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-sm font-black text-purple-900 uppercase tracking-widest flex items-center gap-2.5">
                                <Truck className="h-4 w-4 text-purple-600" />
                                Shiprocket Delivery & Logistics
                            </h3>
                            <Badge className="bg-purple-100 text-purple-800 border-none text-[9px] font-black uppercase">
                                {order.externalShipmentId ? "AWB GENERATED" : order.paymentBreakdown?.shippingRateSource === "local_free" ? "LOCAL FREE" : "READY TO BOOK"}
                            </Badge>
                        </div>

                        {/* Shipping Financial Details */}
                        <div className="bg-white/80 p-3.5 rounded-xl border border-purple-100 space-y-2 mb-4 text-xs">
                            <div className="flex justify-between items-center text-slate-600">
                                <span className="font-bold">Shipping Rate Source:</span>
                                <span className="font-black text-purple-700 uppercase">
                                    {order.paymentBreakdown?.shippingRateSource || (order.paymentBreakdown?.isLocalDelivery ? "local_free" : "standard")}
                                </span>
                            </div>
                            <div className="flex justify-between items-center text-slate-600">
                                <span className="font-bold">Estimated Delivery Fee:</span>
                                <span className="font-black text-slate-900">
                                    ₹{order.paymentBreakdown?.shippingChargeEstimated ?? order.paymentBreakdown?.deliveryFeeCharged ?? order.pricing?.deliveryFee ?? 0}
                                </span>
                            </div>
                            {order.paymentBreakdown?.shippingChargeFinal != null && (
                                <div className="flex justify-between items-center text-slate-600">
                                    <span className="font-bold">Final Shiprocket Charge:</span>
                                    <span className="font-black text-slate-900">
                                        ₹{order.paymentBreakdown.shippingChargeFinal}
                                    </span>
                                </div>
                            )}
                            {order.paymentBreakdown?.shippingChargeDifference != null && (
                                <div className="flex justify-between items-center text-slate-600">
                                    <span className="font-bold">Variance (Final - Est):</span>
                                    <span className={`font-black ${order.paymentBreakdown.shippingChargeDifference > 0 ? "text-amber-600" : "text-emerald-600"}`}>
                                        {order.paymentBreakdown.shippingChargeDifference > 0 ? `+₹${order.paymentBreakdown.shippingChargeDifference}` : `₹${order.paymentBreakdown.shippingChargeDifference}`}
                                    </span>
                                </div>
                            )}
                            {(order.paymentBreakdown?.fulfillmentWarehouseName || order.warehouseId?.warehouseName) && (
                                <div className="flex justify-between items-center text-slate-600 pt-1 border-t border-purple-50">
                                    <span className="font-bold">Fulfillment Warehouse:</span>
                                    <span className="font-black text-slate-800">
                                        {order.paymentBreakdown?.fulfillmentWarehouseName || order.warehouseId?.warehouseName || "Primary Warehouse"}
                                        {order.paymentBreakdown?.fulfillmentWarehouseCity ? ` (${order.paymentBreakdown.fulfillmentWarehouseCity})` : ""}
                                    </span>
                                </div>
                            )}
                        </div>

                        {order.externalShipmentId ? (
                            <div className="space-y-3 text-xs">
                                <div className="flex justify-between items-center bg-white p-3 rounded-lg border border-purple-100">
                                    <span className="font-bold text-slate-500">AWB Code:</span>
                                    <span className="font-mono font-black text-purple-700">{order.externalShipmentId}</span>
                                </div>
                                {order.trackingUrl && (
                                    <a
                                        href={order.trackingUrl}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="w-full py-2 bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs rounded-lg flex items-center justify-center gap-2 shadow-sm transition-all"
                                    >
                                        <Navigation className="h-3.5 w-3.5" /> Live Shiprocket Tracking
                                    </a>
                                )}
                            </div>
                        ) : (
                            <div className="space-y-3">
                                <p className="text-xs text-slate-500 font-medium">
                                    No Shiprocket shipment booked yet. Book automated courier dispatch below:
                                </p>
                                <button
                                    type="button"
                                    onClick={handleShiprocketCreateAdmin}
                                    className="w-full py-2.5 bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs rounded-xl shadow-md flex items-center justify-center gap-2 transition-all"
                                >
                                    <Truck className="h-4 w-4" /> Ship via Shiprocket (Generate AWB)
                                </button>
                            </div>
                        )}
                    </Card>
                </div>

                {/* Right Column */}
                <div className="space-y-6">
                    {/* Customer Node */}
                    <Card className="border-none shadow-xl ring-1 ring-slate-100 bg-white rounded-2xl p-6">
                        <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-6 flex items-center gap-2">
                            <User className="h-4 w-4" />
                            Customer Node Information
                        </h4>
                        <div className="flex items-center gap-4">
                            <img 
                                src="https://cdn-icons-png.flaticon.com/512/149/149071.png" 
                                alt="" 
                                className="h-16 w-16 rounded-2xl bg-slate-50 ring-2 ring-white shadow-sm object-cover" 
                            />
                            <div className="text-left">
                                <h3 className="text-lg font-black text-slate-900 leading-tight">
                                    {(order.customer?.name && order.customer.name.trim() !== '' && order.customer.name.trim().toLowerCase() !== 'customer')
                                        ? order.customer.name
                                        : (order.address?.name || order.customer?.name || 'Customer')}
                                </h3>
                                <p className="text-xs font-bold text-slate-400">
                                    Node ID: {order.customer?._id || 'N/A'}
                                </p>
                            </div>
                        </div>
                        <div className="space-y-6 text-left mt-6">
                            <div className="flex flex-col gap-2">
                                <span className="text-[10px] font-bold text-slate-400 flex items-center gap-3">
                                    <Mail className="h-3.5 w-3.5" /> {order.customer?.email || 'N/A'}
                                </span>
                                <span className="text-[10px] font-bold text-slate-400 flex items-center gap-3">
                                    <Phone className="h-3.5 w-3.5" /> {order.customer?.phone || order.address?.phone || 'N/A'}
                                </span>
                            </div>
                            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                                <div className="flex items-center justify-between gap-2 mb-1">
                                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                        Destination Protocol
                                    </span>
                                    {order?.address?.location &&
                                        typeof order.address.location.lat === "number" &&
                                        typeof order.address.location.lng === "number" && (
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    const { lat, lng } = order.address.location;
                                                    window.open(
                                                        `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`,
                                                        "_blank",
                                                    );
                                                }}
                                                className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-bold text-primary hover:bg-primary/5 transition-colors"
                                            >
                                                <MapPin className="h-3 w-3" />
                                                Open in Maps
                                            </button>
                                        )}
                                </div>
                                <p className="text-xs font-bold text-slate-600 leading-relaxed italic">
                                    "{order.address?.name ? `${order.address.name}${order.address?.phone ? ` (${order.address.phone})` : ''} - ` : ''}{order.address?.address}, {order.address?.landmark ? `${order.address.landmark}, ` : ''}{order.address?.city}{order.address?.pincode ? ` - ${order.address.pincode}` : ''}"
                                </p>
                            </div>
                            {order.address?.type === "Other" &&
                                (order.address?.name || order.address?.phone) && (
                                    <div className="p-4 bg-brand-50 rounded-2xl border border-brand-100 space-y-2">
                                        <div className="flex items-center justify-between gap-2 mb-1">
                                            <span className="text-[10px] font-black text-brand-700 uppercase tracking-widest">
                                                Recipient (Order For Someone Else)
                                            </span>
                                        </div>
                                        <p className="text-xs font-black text-slate-800">
                                            {order.address?.name}
                                        </p>
                                        {order.address?.phone && (
                                            <p className="text-[11px] font-bold text-brand-700 flex items-center gap-2">
                                                <Phone className="h-3.5 w-3.5" />
                                                {order.address.phone}
                                            </p>
                                        )}
                                    </div>
                                )}
                        </div>
                    </Card>

                    {/* Rider Section */}
                    <Card className="border-none shadow-xl ring-1 ring-slate-100 bg-white rounded-xl p-6 text-left">
                        <div className="flex flex-col gap-4">
                            <div className="flex items-center justify-between">
                                <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                                    <Truck className="h-3.5 w-3.5" /> Logistical Agent
                                </h4>
                                <Badge variant={order.deliveryBoy ? "success" : "secondary"} className="text-[8px] font-black uppercase tracking-widest">
                                    {order.deliveryBoy ? "ASSIGNED" : "UNASSIGNED"}
                                </Badge>
                            </div>
                            <div className="flex items-center gap-3 mt-2">
                                <div className="h-10 w-10 bg-slate-50 border border-slate-100 rounded-xl flex items-center justify-center text-slate-300 overflow-hidden">
                                    {order.deliveryBoy ? (
                                        <div className="h-full w-full flex items-center justify-center font-black text-slate-400 bg-brand-50 ds-h3">{order.deliveryBoy.name.charAt(0)}</div>
                                    ) : (
                                        <User className="h-5 w-5" />
                                    )}
                                </div>
                                <div>
                                    <h5 className="text-sm font-black text-slate-900">{order.deliveryBoy?.name || "Pending Rider Assignment"}</h5>
                                    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">CONTACT: {order.deliveryBoy?.phone || "N/A"}</p>
                                </div>
                            </div>
                        </div>
                    </Card>

                    {/* Payment Vector */}
                    <Card className="border-none shadow-xl ring-1 ring-slate-100 bg-white rounded-2xl overflow-hidden text-left">
                        <div className="p-6 bg-slate-900 text-white">
                            <h4 className="text-[10px] font-black uppercase tracking-widest flex items-center gap-2 text-white">
                                <CreditCard className="h-4 w-4 text-brand-400" />
                                Payment Vector
                            </h4>
                        </div>
                        <div className="p-4 space-y-6">
                            <div className="flex justify-between items-center bg-slate-50 p-4 rounded-2xl">
                                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Protocol Summary</span>
                                <Badge className={cn("border-none text-[8px] font-black uppercase", order.payment?.status === 'completed' ? 'bg-brand-100 text-brand-700' : 'bg-amber-100 text-amber-700')}>
                                    {order.payment?.status || 'PENDING'}
                                </Badge>
                            </div>
                            <div className="flex items-center justify-between px-2">
                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">TXN Hash</span>
                                <div className="flex items-center gap-2">
                                    <span className="text-[10px] font-black text-slate-700 truncate max-w-[100px]">{order.payment?.transactionId || 'N/A'}</span>
                                    <button onClick={() => copyToClipboard(order.payment?.transactionId, 'Transaction ID')} className="p-1.5 hover:bg-slate-50 rounded-md text-slate-300"><Copy className="h-3 w-3" /></button>
                                </div>
                            </div>
                            <div className="flex items-center justify-between px-2">
                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Gateway Method</span>
                                <span className="text-[10px] font-black uppercase tracking-widest text-slate-900">{order.payment?.method || 'CASH'}</span>
                            </div>
                        </div>
                    </Card>

                    {/* Intelligence Notes */}
                    <Card className="border-none shadow-xl ring-1 ring-amber-100 bg-amber-50/30 rounded-xl p-6 text-left">
                        <h4 className="text-[10px] font-black text-amber-900 uppercase tracking-widest mb-4 flex items-center gap-2">
                            <Info className="h-4 w-4" />
                            Intelligence Notes
                        </h4>
                        <p className="text-xs font-bold text-amber-800 leading-relaxed italic">
                            "{order.cancelReason ? `Cancellation Payload: ${order.cancelReason}` : `Delivery window scheduled for ${order.timeSlot}. Instructions: Follow local logistical protocols.`}"
                        </p>
                    </Card>
                </div>
            </div>

            {/* Hidden Printable Invoice Template */}
            <div className="fixed -left-[9999px] top-0 pointer-events-none" style={{ zIndex: -100 }}>
                <div 
                    ref={invoiceRef}
                    data-invoice-root="true"
                    style={{ 
                        width: "794px",
                        minWidth: "794px",
                        maxWidth: "794px",
                        backgroundColor: "#ffffff",
                        padding: "36px 40px",
                        boxSizing: "border-box",
                        fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
                        color: "#0f172a",
                        lineHeight: 1.4,
                    }}
                >
                    {/* Header: Brand & Tax Invoice Meta */}
                    <table width="100%" cellPadding="0" cellSpacing="0" style={{ borderCollapse: "collapse", marginBottom: "24px" }}>
                        <tbody>
                            <tr>
                                {/* Left: Brand Identity */}
                                <td width="58%" style={{ verticalAlign: "top" }}>
                                    <div style={{ display: "flex", alignItems: "center", gap: "14px", marginBottom: "8px" }}>
                                        <img 
                                            src={settings?.logoUrl || '/jainaaharlogo-removebg-preview.png'} 
                                            alt="Logo" 
                                            style={{ height: "64px", width: "auto", objectFit: "contain", display: "inline-block" }} 
                                            crossOrigin="anonymous" 
                                        />
                                        <div>
                                            <div style={{ fontSize: "22px", fontWeight: "900", color: "#15803d", letterSpacing: "-0.5px" }}>
                                                {settings?.appName || 'Jain Aahar'}
                                            </div>
                                            <div style={{ fontSize: "11px", fontWeight: "700", color: "#166534" }}>
                                                शुद्ध सात्विक जैन आहार • 100% Pure Sattvik Food
                                            </div>
                                        </div>
                                    </div>
                                    <div style={{ fontSize: "11px", color: "#64748b", lineHeight: "1.5" }}>
                                        {settings?.address || 'Indore Regional Hub, Madhya Pradesh'}<br />
                                        Customer Care: {settings?.supportEmail || 'support@jainahar.com'}
                                        {settings?.taxId ? ` • GSTIN: ${settings.taxId}` : ''}
                                    </div>
                                </td>

                                {/* Right: Tax Invoice Details Badge */}
                                <td width="42%" align="right" style={{ verticalAlign: "top" }}>
                                    <div style={{ 
                                        display: "inline-block", 
                                        textAlign: "right",
                                        backgroundColor: "#f8fafc",
                                        border: "1px solid #e2e8f0",
                                        borderRadius: "10px",
                                        padding: "12px 16px",
                                        minWidth: "220px",
                                        maxWidth: "300px",
                                        boxSizing: "border-box"
                                    }}>
                                        <div style={{ fontSize: "16px", fontWeight: "900", color: "#0f172a", textTransform: "uppercase", letterSpacing: "1px" }}>
                                            TAX INVOICE
                                        </div>
                                        <div style={{ fontSize: "11px", fontWeight: "700", color: "#334155", marginTop: "6px", wordBreak: "break-all" }}>
                                            Invoice Ref: <span style={{ color: "#15803d", fontWeight: "800" }}>#{order.orderId}</span>
                                        </div>
                                        <div style={{ fontSize: "11px", color: "#64748b", marginTop: "3px" }}>
                                            Date: {new Date(order.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}, {new Date(order.createdAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })}
                                        </div>
                                        <div style={{ marginTop: "6px" }}>
                                            <span style={{ 
                                                fontSize: "10px", 
                                                fontWeight: "800", 
                                                textTransform: "uppercase",
                                                letterSpacing: "0.5px",
                                                padding: "3px 8px", 
                                                borderRadius: "6px",
                                                display: "inline-block",
                                                backgroundColor: (String(order.paymentStatus || order.payment?.status || "").toUpperCase() === "PAID") ? "#ecfdf5" : (String(order.paymentMode || order.payment?.method || "").toUpperCase() === "ONLINE" ? "#fff7ed" : "#fef3c7"),
                                                color: (String(order.paymentStatus || order.payment?.status || "").toUpperCase() === "PAID") ? "#065f46" : (String(order.paymentMode || order.payment?.method || "").toUpperCase() === "ONLINE" ? "#c2410c" : "#92400e"),
                                                border: `1px solid ${(String(order.paymentStatus || order.payment?.status || "").toUpperCase() === "PAID") ? "#a7f3d0" : (String(order.paymentMode || order.payment?.method || "").toUpperCase() === "ONLINE" ? "#fed7aa" : "#fde68a")}`
                                            }}>
                                                {String(order.paymentMode || order.payment?.method || "").toUpperCase() === "ONLINE"
                                                    ? (String(order.paymentStatus || order.payment?.status || "").toUpperCase() === "PAID" ? "● Paid Online" : "● Payment Pending")
                                                    : "● Cash On Delivery"}
                                            </span>
                                        </div>
                                    </div>
                                </td>
                            </tr>
                        </tbody>
                    </table>

                    {/* Address Grid: Billed To & Shipped From */}
                    <table width="100%" cellPadding="0" cellSpacing="0" style={{ borderCollapse: "collapse", marginBottom: "22px" }}>
                        <tbody>
                            <tr>
                                {/* Billed To */}
                                <td width="49%" style={{ verticalAlign: "top" }}>
                                    <div style={{ 
                                        border: "1px solid #e2e8f0", 
                                        borderRadius: "10px", 
                                        padding: "14px 16px",
                                        backgroundColor: "#ffffff",
                                        minHeight: "120px"
                                    }}>
                                        <div style={{ fontSize: "10px", fontWeight: "900", color: "#64748b", textTransform: "uppercase", letterSpacing: "1px", marginBottom: "8px" }}>
                                            Billed & Delivered To
                                        </div>
                                        <div style={{ fontSize: "14px", fontWeight: "800", color: "#0f172a", marginBottom: "4px" }}>
                                            {order.customer?.name || order.address?.name || 'Customer'}
                                        </div>
                                        <div style={{ fontSize: "11px", color: "#475569", lineHeight: "1.6" }}>
                                            {order.address?.address || order.address?.completeAddress}
                                            {order.address?.landmark && `, ${order.address.landmark}`}<br />
                                            {[order.address?.city, order.address?.state, order.address?.pincode].filter(Boolean).join(' - ')}
                                        </div>
                                        <div style={{ fontSize: "11px", fontWeight: "700", color: "#0f172a", marginTop: "8px" }}>
                                            Phone: {order.customer?.phone || order.address?.phone || 'N/A'}
                                        </div>
                                    </div>
                                </td>

                                <td width="2%"></td>

                                {/* Shipped From */}
                                <td width="49%" style={{ verticalAlign: "top" }}>
                                    <div style={{ 
                                        border: "1px solid #e2e8f0", 
                                        borderRadius: "10px", 
                                        padding: "14px 16px",
                                        backgroundColor: "#ffffff",
                                        minHeight: "120px"
                                    }}>
                                        <div style={{ fontSize: "10px", fontWeight: "900", color: "#64748b", textTransform: "uppercase", letterSpacing: "1px", marginBottom: "8px" }}>
                                            Shipped & Fulfilled From
                                        </div>
                                        <div style={{ fontSize: "14px", fontWeight: "800", color: "#0f172a", marginBottom: "4px" }}>
                                            {order.seller?.shopName || 'Jain Aahar Fulfillment Store'}
                                        </div>
                                        <div style={{ fontSize: "11px", color: "#475569", lineHeight: "1.6" }}>
                                            {order.seller?.address || settings?.address || 'Certified Sattvik Hub'}<br />
                                            {typeof order.warehouse === 'object' && order.warehouse?.city 
                                                ? `Dispatch Node: ${order.warehouse.city} Hub` 
                                                : (order.address?.city ? `Fulfillment Hub: ${order.address.city}` : 'Fulfillment Center')}
                                        </div>
                                        <div style={{ fontSize: "11px", fontWeight: "700", color: "#15803d", marginTop: "8px" }}>
                                            {settings?.taxId ? `GSTIN: ${settings.taxId}` : 'FSSAI Verified Sattvik Partner'}
                                        </div>
                                    </div>
                                </td>
                            </tr>
                        </tbody>
                    </table>

                    {/* Manifest Table */}
                    <div style={{ marginBottom: "22px", borderRadius: "10px", overflow: "hidden", border: "1px solid #e2e8f0" }}>
                        <table width="100%" cellPadding="0" cellSpacing="0" style={{ borderCollapse: "collapse" }}>
                            <thead>
                                <tr style={{ backgroundColor: "#f1f5f9", borderBottom: "1px solid #cbd5e1" }}>
                                    <th style={{ width: "6%", padding: "10px 12px", fontSize: "10px", fontWeight: "900", color: "#334155", textTransform: "uppercase", textAlign: "center" }}>#</th>
                                    <th style={{ width: "50%", padding: "10px 12px", fontSize: "10px", fontWeight: "900", color: "#334155", textTransform: "uppercase", textAlign: "left" }}>Item Description</th>
                                    <th style={{ width: "14%", padding: "10px 12px", fontSize: "10px", fontWeight: "900", color: "#334155", textTransform: "uppercase", textAlign: "right" }}>Rate</th>
                                    <th style={{ width: "12%", padding: "10px 12px", fontSize: "10px", fontWeight: "900", color: "#334155", textTransform: "uppercase", textAlign: "center" }}>Qty</th>
                                    <th style={{ width: "18%", padding: "10px 12px", fontSize: "10px", fontWeight: "900", color: "#334155", textTransform: "uppercase", textAlign: "right" }}>Total</th>
                                </tr>
                            </thead>
                            <tbody>
                                {order.items?.map((item, idx) => (
                                    <tr key={idx} style={{ 
                                        borderBottom: "1px solid #f1f5f9",
                                        backgroundColor: idx % 2 === 0 ? "#ffffff" : "#fcfdfd"
                                    }}>
                                        <td style={{ padding: "10px 12px", fontSize: "11px", color: "#64748b", fontWeight: "700", textAlign: "center" }}>
                                            {idx + 1}
                                        </td>
                                        <td style={{ padding: "10px 12px", textAlign: "left" }}>
                                            <div style={{ fontSize: "12px", fontWeight: "800", color: "#0f172a" }}>
                                                {item.name || item.product?.name}
                                            </div>
                                            {item.variantSku && (
                                                <div style={{ fontSize: "10px", color: "#64748b", marginTop: "2px" }}>
                                                    Variant: {item.variantSku}
                                                </div>
                                            )}
                                        </td>
                                        <td style={{ padding: "10px 12px", fontSize: "12px", color: "#334155", fontWeight: "700", textAlign: "right" }}>
                                            ₹{item.price}
                                        </td>
                                        <td style={{ padding: "10px 12px", fontSize: "12px", color: "#0f172a", fontWeight: "800", textAlign: "center" }}>
                                            {item.quantity}
                                        </td>
                                        <td style={{ padding: "10px 12px", fontSize: "12px", fontWeight: "900", color: "#0f172a", textAlign: "right" }}>
                                            ₹{item.price * item.quantity}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    {/* Totals Summary */}
                    <table width="100%" cellPadding="0" cellSpacing="0" style={{ borderCollapse: "collapse", marginBottom: "24px" }}>
                        <tbody>
                            <tr>
                                {/* Left: Notes & Sattvik Declaration */}
                                <td width="50%" style={{ verticalAlign: "top", paddingRight: "16px" }}>
                                    <div style={{ 
                                        border: "1px solid #f1f5f9", 
                                        borderRadius: "10px", 
                                        padding: "14px 16px",
                                        backgroundColor: "#f8fafc"
                                    }}>
                                        <div style={{ fontSize: "10px", fontWeight: "900", color: "#166534", textTransform: "uppercase", letterSpacing: "1px", marginBottom: "6px" }}>
                                            Pure Jain Diet Assurance
                                        </div>
                                        <div style={{ fontSize: "11px", color: "#475569", lineHeight: "1.6" }}>
                                            • 100% Shuddh Sattvik Preparation (छने पानी से निर्मित)<br />
                                            • Strictly Zero Onion, Zero Garlic, Zero Underground Roots<br />
                                            • Hygienically packed in certified food-grade material
                                        </div>
                                        <div style={{ borderTop: "1px solid #e2e8f0", marginTop: "10px", paddingTop: "8px", fontSize: "10px", color: "#64748b" }}>
                                            Payment: <b>{order.paymentMode || order.payment?.method || 'ONLINE'}</b> • Status: <b style={{ textTransform: "uppercase", color: "#15803d" }}>{order.paymentStatus || order.payment?.status || 'CONFIRMED'}</b>
                                        </div>
                                    </div>
                                </td>

                                {/* Right: Calculations */}
                                <td width="50%" style={{ verticalAlign: "top" }}>
                                    <div style={{ 
                                        border: "1px solid #e2e8f0", 
                                        borderRadius: "10px", 
                                        padding: "14px 16px",
                                        backgroundColor: "#ffffff"
                                    }}>
                                        <table width="100%" cellPadding="0" cellSpacing="0" style={{ fontSize: "11px" }}>
                                            <tbody>
                                                <tr>
                                                    <td style={{ padding: "4px 0", color: "#64748b", fontWeight: "600" }}>Items Subtotal</td>
                                                    <td align="right" style={{ padding: "4px 0", fontWeight: "700", color: "#0f172a" }}>₹{order.pricing?.subtotal || 0}</td>
                                                </tr>
                                                <tr>
                                                    <td style={{ padding: "4px 0", color: "#64748b", fontWeight: "600" }}>Delivery & Logistics</td>
                                                    <td align="right" style={{ padding: "4px 0", fontWeight: "700", color: Number(order.pricing?.deliveryFee || 0) === 0 ? "#15803d" : "#0f172a" }}>
                                                        {Number(order.pricing?.deliveryFee || 0) === 0 ? "FREE" : `+ ₹${order.pricing?.deliveryFee}`}
                                                    </td>
                                                </tr>
                                                {Number(order.pricing?.handlingFee || 0) > 0 && (
                                                    <tr>
                                                        <td style={{ padding: "4px 0", color: "#64748b", fontWeight: "600" }}>Handling / Packaging</td>
                                                        <td align="right" style={{ padding: "4px 0", fontWeight: "700", color: "#0f172a" }}>+ ₹{order.pricing?.handlingFee}</td>
                                                    </tr>
                                                )}
                                                {Number(order.pricing?.tip || 0) > 0 && (
                                                    <tr>
                                                        <td style={{ padding: "4px 0", color: "#64748b", fontWeight: "600" }}>Delivery Tip</td>
                                                        <td align="right" style={{ padding: "4px 0", fontWeight: "700", color: "#0f172a" }}>+ ₹{order.pricing?.tip}</td>
                                                    </tr>
                                                )}
                                                {Number(order.discountTotal || order.pricing?.discount || 0) > 0 && (
                                                    <tr>
                                                        <td style={{ padding: "4px 0", color: "#15803d", fontWeight: "700" }}>Coupon / Discount</td>
                                                        <td align="right" style={{ padding: "4px 0", fontWeight: "800", color: "#15803d" }}>- ₹{order.discountTotal || order.pricing?.discount}</td>
                                                    </tr>
                                                )}
                                                {Number(order.walletAmount || 0) > 0 && (
                                                    <tr>
                                                        <td style={{ padding: "4px 0", color: "#15803d", fontWeight: "700" }}>Wallet Balance Used</td>
                                                        <td align="right" style={{ padding: "4px 0", fontWeight: "800", color: "#15803d" }}>- ₹{order.walletAmount}</td>
                                                    </tr>
                                                )}
                                                <tr>
                                                    <td colSpan={2} style={{ padding: "8px 0" }}>
                                                        <div style={{ height: "1px", backgroundColor: "#e2e8f0" }}></div>
                                                    </td>
                                                </tr>
                                                <tr>
                                                    <td style={{ fontSize: "13px", fontWeight: "900", color: "#0f172a" }}>Grand Total</td>
                                                    <td align="right" style={{ fontSize: "18px", fontWeight: "900", color: "#15803d" }}>
                                                        ₹{order.pricing?.total || 0}
                                                    </td>
                                                </tr>
                                            </tbody>
                                        </table>
                                    </div>
                                </td>
                            </tr>
                        </tbody>
                    </table>

                    {/* Footer: Centered Verification */}
                    <div style={{ 
                        borderTop: "1px solid #e2e8f0", 
                        paddingTop: "16px", 
                        textAlign: "center",
                        fontSize: "10px",
                        color: "#94a3b8",
                        lineHeight: "1.6"
                    }}>
                        <div style={{ fontWeight: "800", color: "#64748b", textTransform: "uppercase", letterSpacing: "1px" }}>
                            Thank you for your order!
                        </div>
                        <div>
                            This is a digitally generated commercial tax invoice. No physical signature required.
                        </div>
                        <div>
                            {settings?.appName || 'Jain Aahar'} • Contact: {settings?.supportEmail || 'support@jainahar.com'} • Indore, Madhya Pradesh
                        </div>
                    </div>
                </div>
            </div>

            {/* Warehouse Assignment Modal */}
            {showAssignModal && (
                <Modal
                    isOpen={showAssignModal}
                    onClose={() => setShowAssignModal(false)}
                    title={`Assign Warehouse for Order #${order?.orderId || orderId}`}
                    size="lg"
                >
                    <div className="space-y-4 pt-2">
                        {isEvaluating ? (
                            <div className="py-12 text-center text-slate-500 font-semibold text-xs">
                                Evaluating live stock, distances & service radiuses across all active warehouses...
                            </div>
                        ) : (
                            <div className="space-y-3">
                                <div className="text-xs text-slate-500 font-medium">
                                    Select the optimal fulfillment location. Warehouses with 100% available stock are prioritized.
                                </div>

                                <div className="space-y-2 max-h-[60vh] overflow-y-auto pr-1">
                                    {(eligibilityData?.allEvaluations || []).map((wh) => {
                                        const isCurrent = String(order?.warehouse?._id || order?.warehouseId) === String(wh.warehouseId);

                                        return (
                                            <div
                                                key={wh.warehouseId}
                                                className={cn(
                                                    "p-4 rounded-xl border transition-all flex items-center justify-between gap-4",
                                                    wh.hasAllStock
                                                        ? "border-emerald-200 bg-emerald-50/40 hover:bg-emerald-50"
                                                        : "border-slate-200 bg-slate-50/70 opacity-80"
                                                )}
                                            >
                                                <div>
                                                    <div className="flex items-center gap-2">
                                                        <h4 className="font-bold text-slate-900 text-sm">{wh.warehouseName}</h4>
                                                        <span className="text-xs text-slate-500">({wh.city})</span>
                                                        {isCurrent && (
                                                            <span className="px-2 py-0.5 bg-primary/10 text-primary text-[10px] font-black rounded-md">
                                                                CURRENT
                                                            </span>
                                                        )}
                                                    </div>

                                                    <div className="flex items-center gap-3 mt-1.5 text-xs text-slate-600">
                                                        <span>
                                                            Stock: <strong className={wh.hasAllStock ? "text-emerald-700 font-black" : "text-amber-700 font-bold"}>
                                                                {wh.stockFulfillmentPercent}% Available
                                                            </strong>
                                                        </span>
                                                        {wh.distanceKm != null && (
                                                            <span>
                                                                Distance: <strong>{wh.distanceKm} km</strong>
                                                            </span>
                                                        )}
                                                        <span>
                                                            Radius: <strong className={wh.withinServiceRadius ? "text-emerald-600" : "text-amber-600"}>
                                                                {wh.withinServiceRadius ? "Inside Service Zone" : "Outside Zone"}
                                                            </strong>
                                                        </span>
                                                    </div>
                                                </div>

                                                <button
                                                    type="button"
                                                    disabled={isAssigning}
                                                    onClick={() => handleAssignWarehouse(wh.warehouseId)}
                                                    className={cn(
                                                        "px-4 py-2 rounded-xl text-xs font-bold shadow-xs transition-all",
                                                        wh.hasAllStock
                                                            ? "bg-primary hover:bg-primary/90 text-white"
                                                            : "bg-slate-200 hover:bg-slate-300 text-slate-800"
                                                    )}
                                                >
                                                    {isCurrent ? "Re-confirm" : wh.hasAllStock ? "Assign Hub" : "Force Assign"}
                                                </button>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        )}
                    </div>
                </Modal>
            )}
        </div>
    );
};

export default OrderDetail;
