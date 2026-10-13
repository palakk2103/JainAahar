import React, { useRef, useState, useEffect } from 'react';
import { X, Printer, Download } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import { useSettings } from '@core/context/SettingsContext';
import { useToast } from '@shared/components/ui/Toast';

const InvoiceModal = ({ isOpen, onClose, order }) => {
    const { settings } = useSettings();
    const { showToast } = useToast() || {};
    const invoiceRef = useRef(null);
    const [isDownloading, setIsDownloading] = useState(false);
    const [logoDataUrl, setLogoDataUrl] = useState(null);

    const orderRef = order?.orderId || order?.id || 'Order';
    const logoUrl = settings?.logoUrl || '/jainaaharlogo-removebg-preview.png';
    const appName = settings?.appName || 'Jain Aahar';

    // Pre-convert logo to base64 Data URL to prevent CORS or canvas taint issues
    useEffect(() => {
        let isMounted = true;
        const loadLogoAsBase64 = async () => {
            if (!logoUrl) return;
            try {
                const response = await fetch(logoUrl);
                const blob = await response.blob();
                const reader = new FileReader();
                reader.onloadend = () => {
                    if (isMounted && reader.result) {
                        setLogoDataUrl(reader.result);
                    }
                };
                reader.readAsDataURL(blob);
            } catch (e) {
                // Ignore failure and fallback to direct logoUrl
            }
        };
        loadLogoAsBase64();
        return () => { isMounted = false; };
    }, [logoUrl]);

    if (!order) return null;

    const handlePrint = () => {
        const invoiceEl = invoiceRef.current;
        if (!invoiceEl) return;

        // Create an isolated printing iframe to prevent multiple blank pages and modal flow issues
        const iframe = document.createElement('iframe');
        iframe.style.position = 'fixed';
        iframe.style.right = '0';
        iframe.style.bottom = '0';
        iframe.style.width = '0px';
        iframe.style.height = '0px';
        iframe.style.border = '0';
        iframe.id = 'invoice-print-frame';
        document.body.appendChild(iframe);

        const iframeDoc = iframe.contentWindow?.document;
        if (!iframeDoc) {
            window.print();
            return;
        }

        iframeDoc.open();
        iframeDoc.write(`
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="utf-8" />
                <title>Invoice - ${orderRef}</title>
                <style>
                    @page {
                        size: A4 portrait;
                        margin: 8mm;
                    }
                    * {
                        box-sizing: border-box;
                        margin: 0;
                        padding: 0;
                        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
                    }
                    body {
                        background: #ffffff;
                        color: #0f172a;
                        padding: 0;
                        margin: 0;
                        -webkit-print-color-adjust: exact !important;
                        print-color-adjust: exact !important;
                    }
                    .invoice-print-root {
                        width: 100%;
                        max-width: 794px;
                        margin: 0 auto;
                        background: #ffffff;
                    }
                    .invoice-card {
                        padding: 24px 28px !important;
                    }
                    .invoice-header-row {
                        display: flex !important;
                        flex-direction: row !important;
                        justify-content: space-between !important;
                        align-items: flex-start !important;
                        gap: 16px !important;
                        margin-bottom: 20px !important;
                    }
                    .invoice-header-brand {
                        width: 58% !important;
                    }
                    .invoice-header-meta {
                        width: 40% !important;
                        display: flex !important;
                        justify-content: flex-end !important;
                    }
                    .invoice-meta-box {
                        text-align: right !important;
                        min-width: 210px !important;
                    }
                    .invoice-addresses-row {
                        display: grid !important;
                        grid-template-columns: 1fr 1fr !important;
                        gap: 14px !important;
                        margin-bottom: 20px !important;
                    }
                    .invoice-address-card {
                        border: 1px solid #e2e8f0;
                        border-radius: 10px;
                        padding: 12px 14px;
                        background-color: #ffffff;
                    }
                    .invoice-table-container {
                        margin-bottom: 20px;
                        border-radius: 10px;
                        overflow: hidden;
                        border: 1px solid #e2e8f0;
                    }
                    .invoice-table {
                        width: 100%;
                        border-collapse: collapse;
                    }
                    .invoice-bottom-row {
                        display: flex !important;
                        flex-direction: row !important;
                        gap: 16px !important;
                        margin-bottom: 20px !important;
                    }
                    .invoice-diet-box {
                        flex: 1 !important;
                        border: 1px solid #f1f5f9;
                        border-radius: 10px;
                        padding: 12px 14px;
                        background-color: #f8fafc;
                    }
                    .invoice-pricing-box {
                        flex: 1 !important;
                        border: 1px solid #e2e8f0;
                        border-radius: 10px;
                        padding: 12px 14px;
                        background-color: #ffffff;
                    }
                    table {
                        border-collapse: collapse;
                    }
                </style>
            </head>
            <body>
                <div class="invoice-print-root">
                    ${invoiceEl.innerHTML}
                </div>
            </body>
            </html>
        `);
        iframeDoc.close();

        setTimeout(() => {
            try {
                iframe.contentWindow.focus();
                iframe.contentWindow.print();
            } catch (err) {
                console.error("Iframe print error:", err);
                window.print();
            } finally {
                setTimeout(() => {
                    if (document.body.contains(iframe)) {
                        document.body.removeChild(iframe);
                    }
                }, 1500);
            }
        }, 300);
    };

    const handleDownloadPdf = async () => {
        const element = invoiceRef.current;
        if (!element) return;
        
        setIsDownloading(true);
        if (showToast) showToast("Generating PDF Invoice...", "info");

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
                        clonedRoot.style.boxShadow = 'none';
                        clonedRoot.style.padding = '32px 36px';
                    }

                    // Remove any stylesheets or rules with oklch to prevent html2canvas parsing crash
                    const styleSheets = clonedDoc.styleSheets;
                    for (let i = 0; i < styleSheets.length; i++) {
                        try {
                            const rules = styleSheets[i].cssRules || styleSheets[i].rules;
                            if (!rules) continue;
                            for (let j = rules.length - 1; j >= 0; j--) {
                                if (rules[j]?.cssText && rules[j].cssText.includes('oklch')) {
                                    styleSheets[i].deleteRule(j);
                                }
                            }
                        } catch (e) {
                            // Cross-origin stylesheet access restriction
                        }
                    }

                    const style = clonedDoc.createElement('style');
                    style.innerHTML = `
                        :root {
                            --primary: #15803d !important;
                            --secondary: #64748b !important;
                            --background: #ffffff !important;
                            --foreground: #0f172a !important;
                        }
                        .invoice-card { padding: 32px 36px !important; }
                        .invoice-header-row { display: flex !important; flex-direction: row !important; justify-content: space-between !important; align-items: flex-start !important; gap: 16px !important; margin-bottom: 20px !important; }
                        .invoice-header-brand { width: 58% !important; }
                        .invoice-header-meta { width: 40% !important; display: flex !important; justify-content: flex-end !important; }
                        .invoice-meta-box { text-align: right !important; min-width: 210px !important; }
                        .invoice-addresses-row { display: grid !important; grid-template-columns: 1fr 1fr !important; gap: 14px !important; margin-bottom: 20px !important; }
                        .invoice-table-container { margin-bottom: 20px !important; border-radius: 10px !important; overflow: hidden !important; border: 1px solid #e2e8f0 !important; }
                        .invoice-table { width: 100% !important; border-collapse: collapse !important; }
                        .invoice-bottom-row { display: flex !important; flex-direction: row !important; gap: 16px !important; margin-bottom: 20px !important; }
                        .invoice-diet-box { flex: 1 !important; }
                        .invoice-pricing-box { flex: 1 !important; }
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
            const pageHeight = 297;
            const pdfHeight = (canvas.height * pdfWidth) / canvas.width;

            if (pdfHeight <= pageHeight) {
                pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight, undefined, 'FAST');
            } else {
                let heightLeft = pdfHeight;
                let position = 0;
                pdf.addImage(imgData, 'PNG', 0, position, pdfWidth, pdfHeight, undefined, 'FAST');
                heightLeft -= pageHeight;
                while (heightLeft > 0) {
                    position = heightLeft - pdfHeight;
                    pdf.addPage();
                    pdf.addImage(imgData, 'PNG', 0, position, pdfWidth, pdfHeight, undefined, 'FAST');
                    heightLeft -= pageHeight;
                }
            }

            pdf.save(`Invoice_${orderRef}.pdf`);
            if (showToast) showToast("Invoice downloaded successfully!", "success");
        } catch (error) {
            console.error("PDF download failed:", error);
            if (showToast) showToast("Direct PDF creation failed. Opening print preview...", "warning");
            handlePrint();
        } finally {
            setIsDownloading(false);
        }
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <>
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                        className="fixed inset-0 z-[9999] flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-sm"
                    >
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95, y: 10 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: 10 }}
                            transition={{ type: "spring", duration: 0.5, bounce: 0.3 }}
                            onClick={(e) => e.stopPropagation()}
                            className="bg-white rounded-3xl w-full max-w-2xl max-h-[92vh] flex flex-col overflow-hidden shadow-2xl relative"
                        >
                            {/* Modal Header */}
                            <div className="bg-slate-50 px-5 sm:px-6 py-4 border-b border-slate-100 flex items-center justify-between shrink-0">
                                <div>
                                    <h2 className="text-base sm:text-lg font-black text-slate-800">Tax Invoice</h2>
                                    <p className="text-xs text-slate-500 font-medium font-mono">#{orderRef}</p>
                                </div>
                                <button onClick={onClose} className="p-2 bg-white rounded-full hover:bg-slate-200 transition-colors shadow-sm border border-slate-100">
                                    <X size={18} className="text-slate-500" />
                                </button>
                            </div>

                            {/* Scrollable Preview Area */}
                            <div className="flex-1 overflow-y-auto p-2.5 sm:p-5 bg-slate-100/70">
                                <div 
                                    ref={invoiceRef}
                                    data-invoice-root="true"
                                    id="printable-invoice"
                                    className="invoice-card"
                                    style={{
                                        maxWidth: "794px",
                                        margin: "0 auto",
                                        backgroundColor: "#ffffff",
                                        borderRadius: "16px",
                                        border: "1px solid #e2e8f0",
                                        boxShadow: "0 4px 12px rgba(0,0,0,0.03)",
                                        fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
                                        color: "#0f172a",
                                        lineHeight: 1.4,
                                        boxSizing: "border-box"
                                    }}
                                >
                                    {/* Top Header */}
                                    <div className="invoice-header-row">
                                        <div className="invoice-header-brand">
                                            <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "8px" }}>
                                                <img 
                                                    src={logoDataUrl || logoUrl} 
                                                    alt="Logo" 
                                                    style={{ height: "48px", width: "auto", objectFit: "contain", display: "inline-block", flexShrink: 0 }} 
                                                    crossOrigin="anonymous" 
                                                />
                                                <div>
                                                    <div style={{ fontSize: "18px", fontWeight: "900", color: "#15803d", letterSpacing: "-0.5px" }}>
                                                        {appName}
                                                    </div>
                                                    <div style={{ fontSize: "11px", fontWeight: "700", color: "#166534" }}>
                                                        शुद्ध सात्विक जैन आहार • 100% Pure Sattvik
                                                    </div>
                                                </div>
                                            </div>
                                            <div style={{ fontSize: "11px", color: "#64748b", lineHeight: "1.5" }}>
                                                {settings?.address || 'Indore Regional Hub, Madhya Pradesh'}<br />
                                                Support: {settings?.supportEmail || 'support@jainahar.com'}
                                                {settings?.taxId ? ` • GSTIN: ${settings.taxId}` : ''}
                                            </div>
                                        </div>

                                        <div className="invoice-header-meta">
                                            <div className="invoice-meta-box">
                                                <div style={{ fontSize: "14px", fontWeight: "900", color: "#0f172a", textTransform: "uppercase", letterSpacing: "1px" }}>
                                                    TAX INVOICE
                                                </div>
                                                <div style={{ fontSize: "11px", fontWeight: "700", color: "#334155", marginTop: "4px", wordBreak: "break-all" }}>
                                                    Invoice Ref: <span style={{ color: "#15803d", fontWeight: "800" }}>#{orderRef}</span>
                                                </div>
                                                <div style={{ fontSize: "11px", color: "#64748b", marginTop: "2px" }}>
                                                    Date: {new Date(order.createdAt || Date.now()).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
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
                                        </div>
                                    </div>

                                    {/* Addresses */}
                                    <div className="invoice-addresses-row">
                                        <div className="invoice-address-card">
                                            <div style={{ fontSize: "10px", fontWeight: "900", color: "#64748b", textTransform: "uppercase", letterSpacing: "1px", marginBottom: "6px" }}>
                                                Billed & Delivered To
                                            </div>
                                            <div style={{ fontSize: "13px", fontWeight: "800", color: "#0f172a", marginBottom: "3px" }}>
                                                {order.customer?.name || order.address?.name || 'Customer'}
                                            </div>
                                            <div style={{ fontSize: "11px", color: "#475569", lineHeight: "1.5" }}>
                                                {order.address?.address || order.address?.completeAddress}
                                                {order.address?.landmark && `, ${order.address.landmark}`}<br />
                                                {[order.address?.city, order.address?.state, order.address?.pincode].filter(Boolean).join(' - ')}
                                            </div>
                                            <div style={{ fontSize: "11px", fontWeight: "700", color: "#0f172a", marginTop: "6px" }}>
                                                Phone: {order.customer?.phone || order.address?.phone || 'N/A'}
                                            </div>
                                        </div>

                                        <div className="invoice-address-card">
                                            <div style={{ fontSize: "10px", fontWeight: "900", color: "#64748b", textTransform: "uppercase", letterSpacing: "1px", marginBottom: "6px" }}>
                                                Shipped & Fulfilled From
                                            </div>
                                            <div style={{ fontSize: "13px", fontWeight: "800", color: "#0f172a", marginBottom: "3px" }}>
                                                {order.seller?.shopName || 'Jain Aahar Fulfillment Store'}
                                            </div>
                                            <div style={{ fontSize: "11px", color: "#475569", lineHeight: "1.5" }}>
                                                {order.seller?.address || settings?.address || 'Certified Sattvik Hub'}<br />
                                                {order.address?.city ? `Fulfillment Hub: ${order.address.city}` : 'Fulfillment Hub'}
                                            </div>
                                            <div style={{ fontSize: "11px", fontWeight: "700", color: "#15803d", marginTop: "6px" }}>
                                                {settings?.taxId ? `GSTIN: ${settings.taxId}` : 'FSSAI Verified Sattvik Partner'}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Items Table */}
                                    <div className="invoice-table-container">
                                        <table className="invoice-table" cellPadding="0" cellSpacing="0">
                                            <thead>
                                                <tr style={{ backgroundColor: "#f1f5f9", borderBottom: "1px solid #cbd5e1" }}>
                                                    <th style={{ width: "6%", padding: "9px 8px", fontSize: "10px", fontWeight: "900", color: "#334155", textTransform: "uppercase", textAlign: "center" }}>#</th>
                                                    <th style={{ width: "50%", padding: "9px 8px", fontSize: "10px", fontWeight: "900", color: "#334155", textTransform: "uppercase", textAlign: "left" }}>Item Description</th>
                                                    <th style={{ width: "14%", padding: "9px 8px", fontSize: "10px", fontWeight: "900", color: "#334155", textTransform: "uppercase", textAlign: "right" }}>Rate</th>
                                                    <th style={{ width: "12%", padding: "9px 8px", fontSize: "10px", fontWeight: "900", color: "#334155", textTransform: "uppercase", textAlign: "center" }}>Qty</th>
                                                    <th style={{ width: "18%", padding: "9px 8px", fontSize: "10px", fontWeight: "900", color: "#334155", textTransform: "uppercase", textAlign: "right" }}>Total</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {(order.items || []).map((item, idx) => (
                                                    <tr key={idx} style={{ 
                                                        borderBottom: "1px solid #f1f5f9",
                                                        backgroundColor: idx % 2 === 0 ? "#ffffff" : "#fcfdfd"
                                                    }}>
                                                        <td style={{ padding: "9px 8px", fontSize: "11px", color: "#64748b", fontWeight: "700", textAlign: "center" }}>
                                                            {idx + 1}
                                                        </td>
                                                        <td style={{ padding: "9px 8px", textAlign: "left" }}>
                                                            <div style={{ fontSize: "12px", fontWeight: "800", color: "#0f172a" }}>
                                                                {item.name || item.product?.name}
                                                            </div>
                                                            {item.variantSku && (
                                                                <div style={{ fontSize: "10px", color: "#64748b", marginTop: "2px" }}>
                                                                    Variant: {item.variantSku}
                                                                </div>
                                                            )}
                                                        </td>
                                                        <td style={{ padding: "9px 8px", fontSize: "12px", color: "#334155", fontWeight: "700", textAlign: "right" }}>
                                                            ₹{item.price}
                                                        </td>
                                                        <td style={{ padding: "9px 8px", fontSize: "12px", color: "#0f172a", fontWeight: "800", textAlign: "center" }}>
                                                            {item.quantity || item.qty}
                                                        </td>
                                                        <td style={{ padding: "9px 8px", fontSize: "12px", fontWeight: "900", color: "#0f172a", textAlign: "right" }}>
                                                            ₹{item.price * (item.quantity || item.qty)}
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>

                                    {/* Breakdown */}
                                    <div className="invoice-bottom-row">
                                        <div className="invoice-diet-box">
                                            <div style={{ fontSize: "10px", fontWeight: "900", color: "#166534", textTransform: "uppercase", letterSpacing: "1px", marginBottom: "4px" }}>
                                                Pure Jain Diet Assurance
                                            </div>
                                            <div style={{ fontSize: "11px", color: "#475569", lineHeight: "1.5" }}>
                                                • 100% Shuddh Sattvik Preparation (छने पानी से निर्मित)<br />
                                                • Strictly Zero Onion, Zero Garlic, Zero Roots<br />
                                                • Hygienically packaged in certified food containers
                                            </div>
                                        </div>

                                        <div className="invoice-pricing-box">
                                            <table width="100%" cellPadding="0" cellSpacing="0" style={{ fontSize: "11px" }}>
                                                <tbody>
                                                    <tr>
                                                        <td style={{ padding: "3px 0", color: "#64748b", fontWeight: "600" }}>Items Subtotal</td>
                                                        <td align="right" style={{ padding: "3px 0", fontWeight: "700", color: "#0f172a" }}>₹{order.pricing?.subtotal || 0}</td>
                                                    </tr>
                                                    <tr>
                                                        <td style={{ padding: "3px 0", color: "#64748b", fontWeight: "600" }}>Delivery Charges</td>
                                                        <td align="right" style={{ padding: "3px 0", fontWeight: "700", color: Number(order.pricing?.deliveryFee || 0) === 0 ? "#15803d" : "#0f172a" }}>
                                                            {Number(order.pricing?.deliveryFee || 0) === 0 ? "FREE" : `+ ₹${order.pricing?.deliveryFee}`}
                                                        </td>
                                                    </tr>
                                                    {Number(order.pricing?.platformFee || order.paymentBreakdown?.handlingFeeCharged || 0) > 0 && (
                                                        <tr>
                                                            <td style={{ padding: "3px 0", color: "#64748b", fontWeight: "600" }}>Handling Fee</td>
                                                            <td align="right" style={{ padding: "3px 0", fontWeight: "700", color: "#0f172a" }}>
                                                                + ₹{order.pricing?.platformFee || order.paymentBreakdown?.handlingFeeCharged}
                                                            </td>
                                                        </tr>
                                                    )}
                                                    {Number(order.pricing?.tip || 0) > 0 && (
                                                        <tr>
                                                            <td style={{ padding: "3px 0", color: "#64748b", fontWeight: "600" }}>Tip</td>
                                                            <td align="right" style={{ padding: "3px 0", fontWeight: "700", color: "#0f172a" }}>+ ₹{order.pricing?.tip}</td>
                                                        </tr>
                                                    )}
                                                    {Number(order.discountTotal || order.pricing?.discount || 0) > 0 && (
                                                        <tr>
                                                            <td style={{ padding: "3px 0", color: "#15803d", fontWeight: "700" }}>Discount</td>
                                                            <td align="right" style={{ padding: "3px 0", fontWeight: "800", color: "#15803d" }}>- ₹{order.discountTotal || order.pricing?.discount}</td>
                                                        </tr>
                                                    )}
                                                    <tr>
                                                        <td colSpan={2} style={{ padding: "6px 0" }}>
                                                            <div style={{ height: "1px", backgroundColor: "#e2e8f0" }}></div>
                                                        </td>
                                                    </tr>
                                                    <tr>
                                                        <td style={{ fontSize: "12px", fontWeight: "900", color: "#0f172a" }}>Grand Total</td>
                                                        <td align="right" style={{ fontSize: "17px", fontWeight: "900", color: "#15803d" }}>
                                                            ₹{order.pricing?.total || 0}
                                                        </td>
                                                    </tr>
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>

                                    {/* Footer */}
                                    <div style={{ borderTop: "1px solid #e2e8f0", paddingTop: "14px", textAlign: "center", fontSize: "10px", color: "#94a3b8", lineHeight: "1.5" }}>
                                        <div style={{ fontWeight: "800", color: "#64748b", textTransform: "uppercase", letterSpacing: "1px" }}>
                                            Thank you for choosing {appName}!
                                        </div>
                                        <div>This is a digitally generated tax invoice. No signature required.</div>
                                    </div>
                                </div>
                            </div>

                            {/* Footer Actions */}
                            <div className="px-5 sm:px-6 py-4 bg-slate-50 border-t border-slate-100 flex items-center justify-end gap-3 print:hidden shrink-0">
                                <button 
                                    onClick={handlePrint} 
                                    className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-700 font-bold text-xs sm:text-sm hover:bg-slate-100 transition-colors flex items-center gap-2"
                                >
                                    <Printer size={16} /> Print
                                </button>
                                <button 
                                    onClick={handleDownloadPdf} 
                                    disabled={isDownloading}
                                    className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-xs sm:text-sm flex items-center gap-2 shadow-sm transition-colors disabled:opacity-50"
                                >
                                    <Download size={16} /> {isDownloading ? "Generating PDF..." : "Download PDF"}
                                </button>
                            </div>

                            <style>
                                {`
                                    .invoice-card {
                                        padding: 16px;
                                    }
                                    .invoice-header-row {
                                        display: flex;
                                        flex-direction: column;
                                        gap: 12px;
                                        margin-bottom: 16px;
                                    }
                                    .invoice-header-brand {
                                        width: 100%;
                                    }
                                    .invoice-header-meta {
                                        width: 100%;
                                    }
                                    .invoice-meta-box {
                                        background-color: #f8fafc;
                                        border: 1px solid #e2e8f0;
                                        border-radius: 10px;
                                        padding: 12px 14px;
                                        box-sizing: border-box;
                                        text-align: left;
                                    }
                                    .invoice-addresses-row {
                                        display: grid;
                                        grid-template-columns: 1fr;
                                        gap: 12px;
                                        margin-bottom: 16px;
                                    }
                                    .invoice-address-card {
                                        border: 1px solid #e2e8f0;
                                        border-radius: 10px;
                                        padding: 12px 14px;
                                        background-color: #ffffff;
                                        box-sizing: border-box;
                                    }
                                    .invoice-table-container {
                                        margin-bottom: 16px;
                                        border-radius: 10px;
                                        overflow-x: auto;
                                        -webkit-overflow-scrolling: touch;
                                        border: 1px solid #e2e8f0;
                                    }
                                    .invoice-table {
                                        width: 100%;
                                        min-width: 440px;
                                        border-collapse: collapse;
                                    }
                                    .invoice-bottom-row {
                                        display: flex;
                                        flex-direction: column;
                                        gap: 12px;
                                        margin-bottom: 16px;
                                    }
                                    .invoice-diet-box {
                                        border: 1px solid #f1f5f9;
                                        border-radius: 10px;
                                        padding: 12px 14px;
                                        background-color: #f8fafc;
                                        box-sizing: border-box;
                                    }
                                    .invoice-pricing-box {
                                        border: 1px solid #e2e8f0;
                                        border-radius: 10px;
                                        padding: 12px 14px;
                                        background-color: #ffffff;
                                        box-sizing: border-box;
                                    }

                                    /* Tablet, Desktop & Print / PDF (>= 600px) */
                                    @media (min-width: 600px) {
                                        .invoice-card {
                                            padding: 32px 36px;
                                        }
                                        .invoice-header-row {
                                            flex-direction: row;
                                            justify-content: space-between;
                                            align-items: flex-start;
                                            gap: 16px;
                                            margin-bottom: 20px;
                                        }
                                        .invoice-header-brand {
                                            width: 58%;
                                        }
                                        .invoice-header-meta {
                                            width: 40%;
                                            display: flex;
                                            justify-content: flex-end;
                                        }
                                        .invoice-meta-box {
                                            text-align: right;
                                            min-width: 210px;
                                        }
                                        .invoice-addresses-row {
                                            grid-template-columns: 1fr 1fr;
                                            gap: 14px;
                                            margin-bottom: 20px;
                                        }
                                        .invoice-table {
                                            min-width: 100%;
                                        }
                                        .invoice-bottom-row {
                                            flex-direction: row;
                                            gap: 16px;
                                            margin-bottom: 20px;
                                        }
                                        .invoice-diet-box {
                                            flex: 1;
                                        }
                                        .invoice-pricing-box {
                                            flex: 1;
                                        }
                                    }

                                    @page {
                                        size: A4 portrait;
                                        margin: 8mm;
                                    }
                                    @media print {
                                        body {
                                            background: #ffffff !important;
                                            margin: 0 !important;
                                            padding: 0 !important;
                                        }
                                        body * { 
                                            visibility: hidden !important; 
                                        }
                                        #printable-invoice, #printable-invoice * { 
                                            visibility: visible !important; 
                                        }
                                        #printable-invoice { 
                                            position: fixed !important; 
                                            left: 0 !important; 
                                            top: 0 !important; 
                                            right: 0 !important;
                                            width: 100% !important; 
                                            max-width: 794px !important;
                                            margin: 0 auto !important;
                                            box-shadow: none !important;
                                            border: none !important;
                                            padding: 16px !important;
                                            background: #ffffff !important;
                                            z-index: 99999999 !important;
                                            -webkit-print-color-adjust: exact !important;
                                            print-color-adjust: exact !important;
                                        }
                                        .invoice-header-row {
                                            flex-direction: row !important;
                                            justify-content: space-between !important;
                                        }
                                        .invoice-header-brand { width: 58% !important; }
                                        .invoice-header-meta { width: 40% !important; }
                                        .invoice-addresses-row { grid-template-columns: 1fr 1fr !important; }
                                        .invoice-bottom-row { flex-direction: row !important; }
                                    }
                                `}
                            </style>
                        </motion.div>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );
};

export default InvoiceModal;


