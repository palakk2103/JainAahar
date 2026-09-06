import React, { useState, useMemo, useEffect } from 'react';
import { useSearchParams, useNavigate, useLocation } from 'react-router-dom';
import Card from '@shared/components/ui/Card';
import Badge from '@shared/components/ui/Badge';
import { adminApi } from '../services/adminApi';
import { toast } from 'sonner';
import { clearAllCache } from '@core/api/dedupe';
import {
    HiOutlinePlus,
    HiOutlineCube,
    HiOutlineMagnifyingGlass,
    HiOutlineFunnel,
    HiOutlineTrash,
    HiOutlinePencilSquare,
    HiOutlinePhoto,
    HiOutlineArchiveBox,
    HiOutlineTag,
    HiOutlineArrowPath,
    HiOutlineXMark,
    HiOutlineChevronRight,
    HiOutlineCheckCircle,
    HiOutlineExclamationCircle,
    HiOutlineFolderOpen,
    HiOutlineSwatch,
    HiOutlineSquaresPlus,
    HiOutlineSparkles
} from 'react-icons/hi2';
import Modal from '@shared/components/ui/Modal';
import Pagination from '@shared/components/ui/Pagination';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';

export const PRESET_HIGHLIGHT_ICONS = [
  { id: "leaf", emoji: "🌿", name: "Natural / Organic" },
  { id: "avocado", emoji: "🥑", name: "Farm Fresh" },
  { id: "zap", emoji: "⚡", name: "High Protein" },
  { id: "sprout", emoji: "🌱", name: "Source of Fiber" },
  { id: "shield", emoji: "🛡️", name: "Quality / Certified" },
  { id: "heart", emoji: "❤️", name: "Healthy / Low Fat" },
  { id: "star", emoji: "⭐", name: "Premium Quality" },
  { id: "truck", emoji: "🚚", name: "Fast Express Delivery" },
  { id: "wheat", emoji: "🌾", name: "Whole Grain / Pure" },
  { id: "sugarfree", emoji: "🍬", name: "Sugar Free" },
  { id: "sun", emoji: "☀️", name: "Sun Dried" },
  { id: "smile", emoji: "😊", name: "Chemical Free" },
];


const ProductManagement = ({ initialOpenAdd = false }) => {
    const navigate = useNavigate();
    const location = useLocation();
    const [searchParams] = useSearchParams();
    const [products, setProducts] = useState([]);
    const [categories, setCategories] = useState([]); // All categories for dropdowns
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(25);
    const [total, setTotal] = useState(0);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);

    const [searchTerm, setSearchTerm] = useState('');
    const [filterCategory, setFilterCategory] = useState('all');
    const [filterStatus, setFilterStatus] = useState('all'); // Added filterStatus
    const [filterApprovalStatus, setFilterApprovalStatus] = useState('all');
    const [sortBy, setSortBy] = useState('newest');
    const [moderationCounts, setModerationCounts] = useState({
        all: 0,
        pending: 0,
        approved: 0,
        rejected: 0,
    });
    const [moderatingActionId, setModeratingActionId] = useState('');

    const [isProductModalOpen, setIsProductModalOpen] = useState(false);
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
    const [isDeleteAllModalOpen, setIsDeleteAllModalOpen] = useState(false);
    const [isRejectModalOpen, setIsRejectModalOpen] = useState(false);
    const [itemToDelete, setItemToDelete] = useState(null);
    const [isDeleting, setIsDeleting] = useState(false);
    const [itemToReject, setItemToReject] = useState(null);
    const [rejectionNote, setRejectionNote] = useState('');
    const [editingItem, setEditingItem] = useState(null);
    const [modalTab, setModalTab] = useState('general');

    const [formData, setFormData] = useState({
        name: '',
        slug: '',
        sku: '',
        description: '',
        price: '',
        salePrice: '',
        stock: '',
        lowStockAlert: 5,
        unit: 'packet',
        header: '',
        categoryId: '',
        subcategoryId: '',
        status: 'active',
        isFeatured: false,
        tags: '',
        weight: '',
        brand: '',
        mainImage: null,
        galleryImages: [],
        mainImageFile: null,
        galleryFiles: [],
        highlights: [
            { icon: "leaf", label: "100% Natural" },
            { icon: "avocado", label: "Farm Fresh" },
            { icon: "zap", label: "High Protein" },
            { icon: "sprout", label: "Source of Fiber" },
        ],
        variants: [
            { id: Date.now(), name: 'Default', price: '', salePrice: '', stock: '', sku: '' }
        ]
    });

    const [viewingVariants, setViewingVariants] = useState(null);
    const [isVariantsViewModalOpen, setIsVariantsViewModalOpen] = useState(false);

    const fetchCategories = async () => {
        try {
            const response = await adminApi.getCategoryTree();
            if (response.data.success) {
                setCategories(response.data.results || response.data.result || []);
            }
        } catch (error) {
            console.error('Failed to fetch categories');
        }
    };

    const fetchProducts = async (requestedPage = 1) => {
        setIsLoading(true);
        try {
            const params = { page: requestedPage, limit: pageSize };
            if (searchTerm) params.search = searchTerm;
            if (filterCategory !== 'all') params.category = filterCategory;
            if (filterStatus !== 'all') params.status = filterStatus;
            if (filterApprovalStatus !== 'all') params.approvalStatus = filterApprovalStatus;
            if (sortBy) params.sort = sortBy;

            const response = await adminApi.getProductModerationList(params);
            if (response.data.success) {
                const payload = response.data.result || {};
                const list = Array.isArray(payload.items) ? payload.items : (response.data.results || []);
                setProducts(list);
                setTotal(typeof payload.total === 'number' ? payload.total : list.length);
                setPage(typeof payload.page === 'number' ? payload.page : requestedPage);
                setModerationCounts({
                    all: Number(payload?.counts?.all || 0),
                    pending: Number(payload?.counts?.pending || 0),
                    approved: Number(payload?.counts?.approved || 0),
                    rejected: Number(payload?.counts?.rejected || 0),
                });
            }
        } catch (error) {
            toast.error('Failed to fetch products');
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchCategories();
    }, []);

    useEffect(() => {
        const timer = setTimeout(() => {
            fetchProducts(1);
        }, 500); // Debounce search
        return () => clearTimeout(timer);
    }, [searchTerm, filterCategory, filterStatus, filterApprovalStatus, sortBy, pageSize]);

    const handleSave = async () => {
        if (!formData.name?.trim()) {
            toast.error('Please enter Product Title in General Info tab');
            setModalTab('general');
            return;
        }

        const resolvedPrice = (formData.price !== '' && formData.price !== undefined)
            ? formData.price
            : (formData.variants?.find((v) => v.price !== '' && v.price !== undefined)?.price ?? '');

        const numericPrice = Number(resolvedPrice);
        if (resolvedPrice === '' || isNaN(numericPrice) || numericPrice < 0) {
            toast.error('Please enter Price in Item Variants tab');
            setModalTab('variants');
            return;
        }

        const resolvedSalePrice = (formData.salePrice !== '' && formData.salePrice !== undefined)
            ? formData.salePrice
            : (formData.variants?.find((v) => v.salePrice !== '' && v.salePrice !== undefined)?.salePrice ?? '0');

        const resolvedStock = (formData.stock !== '' && formData.stock !== undefined)
            ? formData.stock
            : (formData.variants?.find((v) => v.stock !== '' && v.stock !== undefined)?.stock ?? '0');

        if (!formData.header) {
            toast.error('Please select Main Group (Header) in Groups tab');
            setModalTab('category');
            return;
        }

        if (!formData.categoryId) {
            toast.error('Please select Specific Category in Groups tab');
            setModalTab('category');
            return;
        }

        const selectedHeaderObj = categories.find((h) => h._id === formData.header);
        const selectedCatObj = selectedHeaderObj?.children?.find((c) => c._id === formData.categoryId);
        const hasSubcategories = Array.isArray(selectedCatObj?.children) && selectedCatObj.children.length > 0;

        if (hasSubcategories && !formData.subcategoryId) {
            toast.error('Please select Sub-Category in Groups tab');
            setModalTab('category');
            return;
        }

        setIsSaving(true);
        try {
            const data = new FormData();
            data.append('name', formData.name.trim());
            data.append('slug', formData.slug || '');
            data.append('sku', formData.sku || formData.variants?.[0]?.sku || '');
            data.append('description', formData.description || '');
            data.append('price', String(numericPrice));
            data.append('salePrice', String(Number(resolvedSalePrice) || 0));
            data.append('stock', String(Number(resolvedStock) || 0));
            data.append('lowStockAlert', String(Number(formData.lowStockAlert) || 5));
            data.append('unit', formData.unit || 'packet');
            data.append('headerId', formData.header);
            data.append('categoryId', formData.categoryId);
            data.append('subcategoryId', formData.subcategoryId || '');
            data.append('status', formData.status || 'active');
            data.append('isFeatured', String(Boolean(formData.isFeatured)));
            data.append('brand', formData.brand || '');
            data.append('weight', formData.weight || '');
            data.append('tags', formData.tags || '');
            data.append('variants', JSON.stringify(formData.variants || []));
            data.append('highlights', JSON.stringify(formData.highlights || []));

            if (formData.mainImageFile) {
                data.append('mainImage', formData.mainImageFile);
            } else if (formData.mainImage && typeof formData.mainImage === 'string' && formData.mainImage.startsWith('http')) {
                data.append('mainImageUrl', formData.mainImage);
            }
            if (formData.galleryFiles && formData.galleryFiles.length > 0) {
                formData.galleryFiles.forEach((file) => data.append('galleryImages', file));
            }
            if (Array.isArray(formData.galleryImages) && formData.galleryImages.length > 0) {
                const existingUrls = formData.galleryImages.filter(img => typeof img === 'string' && img.startsWith('http'));
                if (existingUrls.length > 0) {
                    data.append('galleryImages', JSON.stringify(existingUrls));
                }
            }

            if (editingItem) {
                await adminApi.updateProduct(editingItem._id, data);
                clearAllCache();
                toast.success('Product updated successfully');
            } else {
                await adminApi.createProduct(data);
                clearAllCache();
                toast.success('Product created successfully');
            }
            handleCloseModal();
            fetchProducts(page);
        } catch (error) {
            toast.error(error.response?.data?.message || 'Failed to save product');
        } finally {
            setIsSaving(false);
        }
    };

    const submitModerationAction = async (product, action, approvalNote = '') => {
        if (!product?._id) return;

        const actionKey = `${action}:${product._id}`;
        setModeratingActionId(actionKey);
        try {
            if (action === 'approve') {
                const res = await adminApi.approveProductModeration(product._id, { approvalNote });
                clearAllCache();
                toast.success(res?.data?.message || 'Product approved successfully');
            } else {
                const res = await adminApi.rejectProductModeration(product._id, { approvalNote });
                clearAllCache();
                toast.success(res?.data?.message || 'Product rejected successfully');
            }
            fetchProducts(page);
        } catch (error) {
            toast.error(error.response?.data?.message || 'Failed to update product approval status');
        } finally {
            setModeratingActionId('');
        }
    };

    const handleModerationAction = async (product, action) => {
        if (!product?._id) return;

        if (action === 'reject') {
            setItemToReject(product);
            setRejectionNote(product.approvalNote || '');
            setIsRejectModalOpen(true);
            return;
        }

        submitModerationAction(product, action);
    };

    const confirmReject = async () => {
        const note = rejectionNote.trim();
        if (!note) {
            toast.error('Please enter a rejection reason');
            return;
        }

        await submitModerationAction(itemToReject, 'reject', note);
        setIsRejectModalOpen(false);
        setItemToReject(null);
        setRejectionNote('');
    };

    const confirmDelete = async () => {
        if (!itemToDelete?._id) return;
        setIsDeleting(true);
        try {
            await adminApi.deleteProduct(itemToDelete._id);
            clearAllCache();
            toast.success('Product deleted successfully');
            setIsDeleteModalOpen(false);
            setItemToDelete(null);
            fetchProducts(page);
        } catch (error) {
            toast.error(error?.response?.data?.message || 'Failed to delete product');
        } finally {
            setIsDeleting(false);
        }
    };

    const confirmDeleteAll = async () => {
        setIsDeleting(true);
        try {
            const res = await adminApi.deleteAllProducts();
            clearAllCache();
            toast.success(res?.data?.message || 'All products deleted successfully');
            setIsDeleteAllModalOpen(false);
            fetchProducts(1);
        } catch (error) {
            toast.error(error?.response?.data?.message || 'Failed to delete all products');
        } finally {
            setIsDeleting(false);
        }
    };

    const handleImageUpload = (e, type) => {
        const files = Array.from(e.target.files || []);
        if (files.length === 0) {
            return;
        }

        if (type === 'main') {
            const file = files[0];
            const reader = new FileReader();
            reader.onloadend = () => {
                setFormData({ ...formData, mainImage: reader.result, mainImageFile: file });
            };
            reader.readAsDataURL(file);
            return;
        }

        const remainingSlots = Math.max(0, 5 - (formData.galleryImages?.length || 0));
        const galleryFiles = files.slice(0, remainingSlots);
        if (galleryFiles.length === 0) {
            toast.error('Max 5 gallery images allowed');
            return;
        }

        Promise.all(
            galleryFiles.map((file) => new Promise((resolve) => {
                const reader = new FileReader();
                reader.onloadend = () => resolve({ file, url: reader.result });
                reader.readAsDataURL(file);
            }))
        ).then((results) => {
            setFormData({
                ...formData,
                galleryImages: [...(formData.galleryImages || []), ...results.map((item) => item.url)],
                galleryFiles: [...(formData.galleryFiles || []), ...results.map((item) => item.file)]
            });
        });
    };

    const openModal = (item = null) => {
        if (item) {
            setFormData({
                name: item.name || '',
                slug: item.slug || '',
                sku: item.sku || '',
                description: item.description || '',
                price: item.price !== undefined && item.price !== null ? String(item.price) : '',
                salePrice: item.salePrice || item.discountPrice || '',
                stock: item.stock !== undefined && item.stock !== null ? String(item.stock) : '0',
                lowStockAlert: item.lowStockAlert || 5,
                unit: item.unit || 'packet',
                header: item.headerId?._id || item.headerId || item.header?._id || item.header || '',
                categoryId: item.categoryId?._id || item.categoryId || item.category?._id || item.category || '',
                subcategoryId: item.subcategoryId?._id || item.subcategoryId || item.subcategory?._id || item.subcategory || '',
                status: item.status || 'active',
                isFeatured: item.isFeatured || false,
                tags: Array.isArray(item.tags) ? item.tags.join(', ') : item.tags || '',
                weight: item.weight || '',
                brand: item.brand || '',
                mainImage: item.mainImage || null,
                galleryImages: item.galleryImages || item.images || [],
                mainImageFile: null,
                galleryFiles: [],
                highlights: item.highlights && item.highlights.length > 0 ? item.highlights : [
                    { icon: "leaf", label: "100% Natural" },
                    { icon: "avocado", label: "Farm Fresh" },
                    { icon: "zap", label: "High Protein" },
                    { icon: "sprout", label: "Source of Fiber" }
                ],
                variants: (item.variants && item.variants.length > 0) ? item.variants.map(v => ({ ...v, id: v._id || Date.now() })) : [
                    {
                        id: Date.now(),
                        name: 'Default',
                        price: item.price || '',
                        salePrice: item.salePrice || item.discountPrice || '',
                        stock: item.stock || '',
                        sku: item.sku || ''
                    }
                ]
            });
            setEditingItem(item);
        } else {
            setFormData({
                name: '', slug: '', sku: '', description: '', price: '',
                salePrice: '', stock: '', lowStockAlert: 5, unit: 'packet',
                header: '', categoryId: '', subcategoryId: '', status: 'active',
                isFeatured: false, tags: '', weight: '', brand: '',
                mainImage: null, galleryImages: [],
                mainImageFile: null, galleryFiles: [],
                highlights: [
                    { icon: "leaf", label: "100% Natural" },
                    { icon: "avocado", label: "Farm Fresh" },
                    { icon: "zap", label: "High Protein" },
                    { icon: "sprout", label: "Source of Fiber" }
                ],
                variants: [
                    { id: Date.now(), name: 'Default', price: '', salePrice: '', stock: '', sku: '' }
                ]
            });
            setEditingItem(null);
        }
        setModalTab('general');
        setIsProductModalOpen(true);
    };

    const handleCloseModal = () => {
        setIsProductModalOpen(false);
        if (location.pathname.endsWith('/add') || searchParams.get('action') === 'add') {
            navigate('/admin/products', { replace: true });
        }
    };

    useEffect(() => {
        if (initialOpenAdd || searchParams.get('action') === 'add' || location.pathname.endsWith('/add')) {
            openModal(null);
        }
    }, [initialOpenAdd, location.pathname, searchParams]);

    const productsList = Array.isArray(products) ? products : [];
    const stats = useMemo(() => ({
        total: total,
        lowStock: productsList.filter(p => p.stock > 0 && p.stock <= 10).length,
        outOfStock: productsList.filter(p => p.stock === 0).length,
        active: productsList.filter(p => p.status === 'active').length
    }), [productsList, total]);

    const StatusBadge = ({ status, stock }) => {
        if (stock === 0) return <Badge variant="error" className="text-[10px] px-1.5 py-0">Out of Stock</Badge>;
        if (stock <= 10) return <Badge variant="warning" className="text-[10px] px-1.5 py-0">Low Stock</Badge>;
        if (status === 'active') return <Badge variant="success" className="text-[10px] px-1.5 py-0">Active</Badge>;
        return <Badge variant="gray" className="text-[10px] px-1.5 py-0">Draft</Badge>;
    };

    const ApprovalBadge = ({ approvalStatus }) => {
        const normalized = String(approvalStatus || 'approved').toLowerCase();
        if (normalized === 'pending') {
            return <Badge variant="warning" className="text-[10px] px-1.5 py-0">Pending</Badge>;
        }
        if (normalized === 'rejected') {
            return <Badge variant="error" className="text-[10px] px-1.5 py-0">Rejected</Badge>;
        }
        return <Badge variant="success" className="text-[10px] px-1.5 py-0">Approved</Badge>;
    };

    return (
        <div className="ds-section-spacing animate-in fade-in slide-in-from-bottom-2 duration-700 pb-16">
            {/* Page Header */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                <div>
                    <h1 className="ds-h1 flex items-center gap-2">
                        Product List
                        <Badge variant="primary" className="text-[9px] px-1.5 py-0 font-bold tracking-wider uppercase">Live</Badge>
                    </h1>
                    <p className="ds-description mt-0.5">Track your items, prices, and how many are left in stock.</p>
                </div>
                <div className="flex items-center gap-3 self-start lg:self-center">
                    <button
                        onClick={() => setIsDeleteAllModalOpen(true)}
                        disabled={productsList.length === 0}
                        className="flex items-center space-x-2 px-4 py-2.5 bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200 rounded-xl text-xs font-bold transition-all shadow-sm disabled:opacity-50 disabled:cursor-not-allowed active:scale-95"
                        title="Delete All Products"
                    >
                        <HiOutlineTrash className="h-4 w-4" />
                        <span>Delete All Products</span>
                    </button>
                    <button
                        onClick={() => openModal(null)}
                        className="flex items-center space-x-2 px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-all shadow-md active:scale-95"
                    >
                        <HiOutlinePlus className="h-4 w-4" />
                        <span>Add Product</span>
                    </button>
                </div>
            </div>

            {/* Quick Stats */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {[
                    { label: 'All Items', val: stats.total, icon: HiOutlineCube, color: 'text-brand-600', bg: 'bg-brand-50' },
                    { label: 'Active Items', val: stats.active, icon: HiOutlineCheckCircle, color: 'text-brand-600', bg: 'bg-brand-50' },
                    { label: 'Low Stock', val: stats.lowStock, icon: HiOutlineExclamationCircle, color: 'text-amber-600', bg: 'bg-amber-50' },
                    { label: 'Out of Stock', val: stats.outOfStock, icon: HiOutlineArchiveBox, color: 'text-rose-600', bg: 'bg-rose-50' }
                ].map((stat, i) => (
                    <Card key={i} className="border-none shadow-sm ring-1 ring-slate-100 p-4 relative overflow-hidden group">
                        <div className="flex items-center gap-3">
                            <div className={cn("h-10 w-10 rounded-xl flex items-center justify-center transition-transform group-hover:scale-110 duration-300", stat.bg, stat.color)}>
                                <stat.icon className="h-5 w-5" />
                            </div>
                            <div>
                                <p className="ds-label">{stat.label}</p>
                                <h4 className="ds-stat-medium">{stat.val}</h4>
                            </div>
                        </div>
                    </Card>
                ))}
            </div>

            <Card className="border-none shadow-sm ring-1 ring-slate-100 p-3 bg-white/60 backdrop-blur-xl">
                <div className="flex flex-wrap gap-2">
                    {[
                        { key: 'all', label: 'All', count: moderationCounts.all },
                        { key: 'approved', label: 'Approved', count: moderationCounts.approved },
                        { key: 'pending', label: 'Pending Approval', count: moderationCounts.pending },
                        { key: 'rejected', label: 'Rejected', count: moderationCounts.rejected },
                    ].map((item) => (
                        <button
                            key={item.key}
                            type="button"
                            onClick={() => setFilterApprovalStatus(item.key)}
                            className={cn(
                                "rounded-xl px-4 py-2 text-xs font-bold transition-all",
                                filterApprovalStatus === item.key
                                    ? "bg-slate-900 text-white"
                                    : "bg-white ring-1 ring-slate-200 text-slate-600 hover:bg-slate-50"
                            )}
                        >
                            {item.label} ({item.count})
                        </button>
                    ))}
                </div>
            </Card>

            {/* Toolbox */}
            <Card className="border-none shadow-sm ring-1 ring-slate-100 p-3 bg-white/60 backdrop-blur-xl">
                <div className="flex flex-col lg:flex-row gap-3 items-center">
                    <div className="relative flex-1 group w-full">
                        <HiOutlineMagnifyingGlass className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 group-focus-within:text-primary transition-all" />
                        <input
                            type="text"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            placeholder="Search by name, SKU or slug..."
                            className="w-full pl-10 pr-4 py-2.5 bg-slate-100/50 border-none rounded-xl text-xs font-semibold text-slate-700 placeholder:text-slate-400 focus:ring-2 focus:ring-primary/5 transition-all outline-none"
                        />
                    </div>
                    <div className="flex gap-2 shrink-0 w-full lg:w-auto">
                        <select
                            value={filterCategory}
                            onChange={(e) => setFilterCategory(e.target.value)}
                            className="flex-1 lg:flex-none px-4 py-2.5 bg-white ring-1 ring-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:ring-2 focus:ring-primary/5 outline-none appearance-none cursor-pointer"
                        >
                            <option value="all">All Categories</option>
                            {categories.map(h => (
                                <optgroup key={h._id} label={h.name}>
                                    <option value={h._id}>All {h.name}</option>
                                    {(h.children || []).map(c => (
                                        <option key={c._id} value={c._id}>{c.name}</option>
                                    ))}
                                </optgroup>
                            ))}
                        </select>
                        <button
                            onClick={() => {
                                const nextStatus = filterStatus === 'all' ? 'active' : filterStatus === 'active' ? 'inactive' : 'all';
                                setFilterStatus(nextStatus);
                            }}
                            className={cn(
                                "flex items-center space-x-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap",
                                filterStatus === 'active' ? "bg-brand-500 text-primary-foreground shadow-md shadow-brand-100" :
                                    filterStatus === 'inactive' ? "bg-amber-500 text-white shadow-md shadow-amber-100" :
                                        "bg-white ring-1 ring-slate-200 text-slate-600 hover:bg-slate-50"
                            )}
                            >
                            <HiOutlineFunnel className="h-4 w-4" />
                            <span>
                                {filterStatus === 'active' ? 'ONLY LIVE' :
                                    filterStatus === 'inactive' ? 'ONLY DRAFT' :
                                        'SHOW ALL'}
                            </span>
                        </button>
                        <select
                            value={sortBy}
                            onChange={(e) => setSortBy(e.target.value)}
                            className="flex-1 lg:flex-none px-4 py-2.5 bg-white ring-1 ring-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:ring-2 focus:ring-primary/5 outline-none appearance-none cursor-pointer"
                        >
                            <option value="newest">Newest first</option>
                            <option value="oldest">Oldest first</option>
                            <option value="name-asc">Name A-Z</option>
                            <option value="name-desc">Name Z-A</option>
                            <option value="price-asc">Price Low-High</option>
                            <option value="price-desc">Price High-Low</option>
                            <option value="stock-asc">Stock Low-High</option>
                            <option value="stock-desc">Stock High-Low</option>
                        </select>
                    </div>
                </div>
            </Card>

            {/* Product Table */}
            <Card className="border-none shadow-xl ring-1 ring-slate-100 overflow-hidden rounded-xl">
                <div className="overflow-x-auto">
                    <table className="w-full min-w-[1180px] table-fixed text-left border-collapse">
                        <colgroup>
                            <col className="w-[28%]" />
                            <col className="w-[15%]" />
                            <col className="w-[15%]" />
                            <col className="w-[15%]" />
                            <col className="w-[12%]" />
                            <col className="w-[15%]" />
                        </colgroup>
                        <thead>
                            <tr className="bg-slate-50/50 border-b border-slate-100">
                                <th className="px-6 py-3 text-left text-[10px] font-medium text-slate-500 uppercase tracking-[0.18em]">Product</th>
                                <th className="px-6 py-3 text-left text-[10px] font-medium text-slate-500 uppercase tracking-[0.18em]">Variant</th>
                                <th className="px-6 py-3 text-left text-[10px] font-medium text-slate-500 uppercase tracking-[0.18em]">Category</th>
                                <th className="px-6 py-3 text-left text-[10px] font-medium text-slate-500 uppercase tracking-[0.18em]">Subcategory</th>
                                <th className="px-4 py-3 text-center text-[10px] font-medium text-slate-500 uppercase tracking-[0.18em] whitespace-nowrap">Status</th>
                                <th className="px-4 py-3 text-center text-[10px] font-medium text-slate-500 uppercase tracking-[0.18em] whitespace-nowrap">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                            {isLoading ? (
                                <tr>
                                    <td colSpan={6} className="px-6 py-20 text-center">
                                        <div className="flex flex-col items-center gap-3">
                                            <HiOutlineArrowPath className="h-8 w-8 text-primary animate-spin" />
                                            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Loading Products...</p>
                                        </div>
                                    </td>
                                </tr>
                            ) : productsList.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="px-6 py-20 text-center text-slate-400 font-bold text-xs uppercase tracking-widest">No products found</td>
                                </tr>
                            ) : productsList.map((p) => (
                                <tr
                                    key={p._id}
                                    className={cn(
                                        "group transition-colors hover:bg-slate-50/60",
                                        String(p.approvalStatus || '').toLowerCase() === 'pending' && "bg-amber-50/40"
                                    )}
                                >
                                    {/* Product Column */}
                                    <td className="px-6 py-5 align-middle">
                                        <div className="flex items-center gap-3 min-w-0">
                                            <div className="h-11 w-11 shrink-0 rounded-xl overflow-hidden bg-slate-100 ring-1 ring-slate-200 shadow-sm flex items-center justify-center">
                                                {p.mainImage || p.images?.[0] ? (
                                                    <img
                                                        src={p.mainImage || p.images?.[0]}
                                                        alt={p.name}
                                                        className="h-full w-full object-cover group-hover:scale-110 transition-transform duration-500"
                                                        onError={(e) => {
                                                             e.currentTarget.style.display = 'none';
                                                             e.currentTarget.nextElementSibling?.classList.remove('hidden');
                                                        }}
                                                    />
                                                ) : null}
                                                <div className={cn("flex items-center justify-center h-full w-full bg-slate-100 text-slate-400", (p.mainImage || p.images?.[0]) ? "hidden" : "")}>
                                                    <HiOutlinePhoto className="h-5 w-5 text-slate-300" />
                                                </div>
                                            </div>
                                            <div className="min-w-0">
                                                <p className="truncate text-[13px] font-semibold leading-5 text-slate-900" title={p.name}>{p.name}</p>
                                                <p className="truncate text-[10px] font-medium uppercase tracking-widest text-slate-400" title={p.unit}>{p.unit}</p>
                                                {p.approvalStatus === 'rejected' && p.approvalNote ? (
                                                    <p className="truncate text-[10px] font-medium text-rose-500" title={p.approvalNote}>
                                                        Note: {p.approvalNote}
                                                    </p>
                                                ) : null}
                                            </div>
                                        </div>
                                    </td>

                                    {/* Variant Column */}
                                    <td
                                        className="px-6 py-5 cursor-pointer align-middle transition-colors group/variant hover:bg-purple-50/60"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setViewingVariants(p);
                                            setIsVariantsViewModalOpen(true);
                                        }}
                                    >
                                        {p.variants && p.variants.length > 0 ? (
                                            <div className="inline-flex items-center gap-1.5 rounded-full bg-purple-50 px-2.5 py-1 text-purple-700 ring-1 ring-purple-100 transition-transform group-hover/variant:-translate-y-0.5">
                                                <HiOutlineSwatch className="h-3.5 w-3.5 shrink-0 text-purple-500" />
                                                <span className="text-[12px] font-medium whitespace-nowrap">
                                                    {p.variants.length} Variant{p.variants.length > 1 ? 's' : ''}
                                                </span>
                                            </div>
                                        ) : (
                                            <span className="text-[12px] font-medium text-slate-400">No variants</span>
                                        )}
                                    </td>

                                    {/* Category Column */}
                                    <td className="px-6 py-5 align-middle">
                                        <span
                                            className="inline-block max-w-full rounded-full bg-slate-100 px-3 py-1 text-[12px] font-medium text-slate-700 ring-1 ring-slate-200 truncate"
                                            title={p.categoryId?.name || 'N/A'}
                                        >
                                            {p.categoryId?.name || 'N/A'}
                                        </span>
                                    </td>

                                    {/* Subcategory Column */}
                                    <td className="px-6 py-5 align-middle">
                                        <span
                                            className="inline-block max-w-full rounded-full bg-slate-50 px-3 py-1 text-[12px] font-medium text-slate-600 ring-1 ring-slate-100 truncate"
                                            title={p.subcategoryId?.name || 'N/A'}
                                        >
                                            {p.subcategoryId?.name || 'N/A'}
                                        </span>
                                    </td>


                                    {/* Status Column */}
                                    <td className="px-4 py-5 text-center align-middle whitespace-nowrap">
                                        <div className="flex flex-col items-center gap-1">
                                            <StatusBadge status={p.status} stock={p.stock} />
                                            <ApprovalBadge approvalStatus={p.approvalStatus} />
                                        </div>
                                    </td>

                                    {/* Actions Column */}
                                    <td className="px-4 py-5 text-center align-middle">
                                        <div className="flex items-center justify-center gap-2">
                                            <button
                                                onClick={() => handleModerationAction(p, 'approve')}
                                                disabled={moderatingActionId === `approve:${p._id}`}
                                                className="flex h-9 w-9 shrink-0 items-center justify-center hover:bg-emerald-50 hover:text-emerald-600 rounded-xl transition-all text-slate-400 shadow-sm ring-1 ring-slate-100 disabled:opacity-60"
                                                title="Approve product"
                                            >
                                                <HiOutlineCheckCircle className="h-4 w-4" />
                                            </button>
                                            <button
                                                onClick={() => handleModerationAction(p, 'reject')}
                                                disabled={moderatingActionId === `reject:${p._id}`}
                                                className="flex h-9 w-9 shrink-0 items-center justify-center hover:bg-amber-50 hover:text-amber-600 rounded-xl transition-all text-slate-400 shadow-sm ring-1 ring-slate-100 disabled:opacity-60"
                                                title="Reject product"
                                            >
                                                <HiOutlineXMark className="h-4 w-4" />
                                            </button>
                                            <button
                                                onClick={() => openModal(p)}
                                                className="flex h-9 w-9 shrink-0 items-center justify-center hover:bg-white hover:text-primary rounded-xl transition-all text-slate-400 shadow-sm ring-1 ring-slate-100"
                                            >
                                                <HiOutlinePencilSquare className="h-4 w-4" />
                                            </button>
                                            <button
                                                onClick={() => (setItemToDelete(p), setIsDeleteModalOpen(true))}
                                                className="flex h-9 w-9 shrink-0 items-center justify-center hover:bg-rose-50 hover:text-rose-600 rounded-xl transition-all text-slate-400 shadow-sm ring-1 ring-slate-100"
                                            >
                                                <HiOutlineTrash className="h-4 w-4" />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
                <div className="px-6 py-3 border-t border-slate-100">
                    <Pagination
                        page={page}
                        totalPages={Math.ceil(total / pageSize) || 1}
                        total={total}
                        pageSize={pageSize}
                        onPageChange={(p) => fetchProducts(p)}
                        onPageSizeChange={(newSize) => {
                            setPageSize(newSize);
                            setPage(1);
                        }}
                        loading={isLoading}
                    />
                </div>
            </Card>

            {/* Super Detailed Modal */}
            <AnimatePresence>
                {isProductModalOpen && (
                    <div
                        className="fixed inset-0 z-[100] flex items-center justify-center p-4 lg:p-12 overflow-hidden overscroll-contain touch-pan-y"
                        onWheelCapture={(e) => e.stopPropagation()}
                    >
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="fixed inset-0 bg-slate-900/40 backdrop-blur-md"
                            onClick={handleCloseModal}
                        />
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95, y: 10 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: 10 }}
                            className="w-full max-w-5xl relative z-10 bg-white rounded-xl shadow-2xl overflow-hidden flex flex-col"
                        >
                            {/* Modal Header */}
                            <div className="flex items-center justify-between p-6 border-b border-slate-100">
                                <div className="flex items-center space-x-3">
                                    <div className="h-10 w-10 bg-slate-900 text-white rounded-xl flex items-center justify-center">
                                        <HiOutlineCube className="h-5 w-5" />
                                    </div>
                                    <div>
                                        <h3 className="admin-h3">
                                            {editingItem ? 'Edit Product' : 'Add Product'}
                                        </h3>
                                        <div className="flex items-center space-x-2 mt-0.5">
                                            <Badge variant="primary" className="text-[7px] font-bold uppercase tracking-widest px-1">SYSTEM</Badge>
                                            <HiOutlineChevronRight className="h-2.5 w-2.5 text-slate-300" />
                                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{formData.sku || 'PENDING SKU'}</span>
                                        </div>
                                    </div>
                                </div>
                                <button onClick={handleCloseModal} className="p-2 hover:bg-slate-100 rounded-full transition-colors text-slate-400">
                                    <HiOutlineXMark className="h-5 w-5" />
                                </button>
                            </div>

                            <div className="flex flex-col lg:flex-row flex-1 min-h-0 min-h-[400px] max-h-[calc(100vh-200px)] overflow-hidden">
                                {/* Modal Sidebar Tabs */}
                                <div className="lg:w-1/4 bg-slate-50/50 border-r border-slate-100 p-4 space-y-1 overflow-y-auto overscroll-contain scrollbar-hide min-h-0">
                                    {[
                                        { id: 'general', label: 'General Info', icon: HiOutlineTag },
                                        { id: 'variants', label: 'Item Variants', icon: HiOutlineSwatch },
                                        { id: 'highlights', label: 'Highlights', icon: HiOutlineSparkles },
                                        { id: 'category', label: 'Groups', icon: HiOutlineFolderOpen },
                                        { id: 'media', label: 'Photos', icon: HiOutlinePhoto }
                                    ].map((tab) => (
                                        <button
                                            key={tab.id}
                                            onClick={() => setModalTab(tab.id)}
                                            className={cn(
                                                "w-full flex items-center space-x-3 px-4 py-3 rounded-xl text-xs font-bold transition-all",
                                                modalTab === tab.id
                                                    ? "bg-white text-primary shadow-sm ring-1 ring-slate-100"
                                                    : "text-slate-500 hover:bg-slate-100"
                                            )}
                                        >
                                            <tab.icon className="h-4 w-4" />
                                            <span>{tab.label}</span>
                                        </button>
                                    ))}

                                    <div className="pt-8 px-4">
                                        <div className="p-4 bg-brand-50 rounded-2xl border border-brand-100">
                                            <p className="text-[9px] font-bold text-brand-600 uppercase tracking-widest mb-1">Status</p>
                                            <select
                                                value={formData.status}
                                                onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                                                className="w-full bg-transparent border-none text-xs font-bold text-brand-700 outline-none p-0 cursor-pointer"
                                            >
                                                <option value="active">PUBLISHED</option>
                                                <option value="inactive">DRAFT</option>
                                            </select>
                                        </div>
                                        <div className="mt-3 p-4 bg-brand-50 rounded-2xl border border-brand-100 flex items-center justify-between">
                                            <p className="text-[9px] font-bold text-brand-600 uppercase tracking-widest">Featured</p>
                                            <input
                                                type="checkbox"
                                                checked={formData.isFeatured}
                                                onChange={(e) => setFormData({ ...formData, isFeatured: e.target.checked })}
                                                className="h-4 w-4 rounded border-brand-300 text-primary focus:ring-primary"
                                            />
                                        </div>
                                    </div>
                                </div>

                                {/* Modal Content Area */}
                                <div className="flex-1 p-4 overflow-y-auto overscroll-contain touch-pan-y min-h-0">
                                    {modalTab === 'general' && (
                                        <div className="ds-section-spacing animate-in fade-in slide-in-from-right-2 duration-300">
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                                <div className="space-y-1.5 flex flex-col">
                                                    <label className="text-[9px] font-bold text-slate-400 uppercase tracking-widest ml-1">Product Title</label>
                                                    <input
                                                        value={formData.name}
                                                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                                        className="w-full px-4 py-2.5 bg-slate-100 border-none rounded-xl text-sm font-semibold outline-none ring-primary/5 focus:ring-2"
                                                        placeholder="e.g. Premium Basmati Rice"
                                                    />
                                                </div>
                                                <div className="space-y-1.5 flex flex-col">
                                                    <label className="text-[9px] font-bold text-slate-400 uppercase tracking-widest ml-1">Web Address</label>
                                                    <div className="flex items-center bg-slate-50 rounded-xl px-4 py-2.5">
                                                        <span className="text-[10px] text-slate-400 font-bold mr-1">/product/</span>
                                                        <input
                                                            value={formData.slug}
                                                            onChange={(e) => setFormData({ ...formData, slug: e.target.value })}
                                                            className="flex-1 bg-transparent border-none text-sm text-slate-500 font-semibold outline-none"
                                                            placeholder="premium-basmati-rice"
                                                        />
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="space-y-1.5 flex flex-col">
                                                <label className="text-[9px] font-bold text-slate-400 uppercase tracking-widest ml-1">About this item</label>
                                                <textarea
                                                    value={formData.description}
                                                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                                    onWheel={(e) => e.stopPropagation()}
                                                    onTouchMove={(e) => e.stopPropagation()}
                                                    className="w-full px-4 py-3 bg-slate-100 border-none rounded-2xl text-sm font-semibold min-h-[160px] max-h-[260px] outline-none resize-none overflow-y-auto custom-scrollbar"
                                                    placeholder="Describe the item here..."
                                                />
                                            </div>
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                                <div className="space-y-1.5 flex flex-col">
                                                    <label className="text-[9px] font-bold text-slate-400 uppercase tracking-widest ml-1">Brand Name</label>
                                                    <input
                                                        value={formData.brand}
                                                        onChange={(e) => setFormData({ ...formData, brand: e.target.value })}
                                                        className="w-full px-4 py-2.5 bg-slate-100 border-none rounded-xl text-sm font-semibold outline-none ring-primary/5 focus:ring-2"
                                                        placeholder="e.g. Amul"
                                                    />
                                                </div>
                                                <div className="space-y-1.5 flex flex-col">
                                                    <label className="text-[9px] font-bold text-slate-400 uppercase tracking-widest ml-1">Product Code / SKU</label>
                                                    <input
                                                        value={formData.sku}
                                                        onChange={(e) => setFormData({ ...formData, sku: e.target.value })}
                                                        className="w-full px-4 py-2.5 bg-slate-100 border-none rounded-xl text-sm font-mono font-bold outline-none ring-primary/5 focus:ring-2"
                                                        placeholder="AUTO-GENERATED"
                                                    />
                                                </div>
                                            </div>

                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                                <div className="space-y-1.5 flex flex-col">
                                                    <label className="text-[9px] font-bold text-slate-700 uppercase tracking-widest ml-1">Regular MRP Price (₹) <span className="text-rose-500">*</span></label>
                                                    <input
                                                        type="number"
                                                        min="0"
                                                        value={formData.price}
                                                        onChange={(e) => {
                                                            const val = e.target.value;
                                                            setFormData((prev) => ({
                                                                ...prev,
                                                                price: val,
                                                                variants: prev.variants?.length > 0 ? prev.variants.map((v, i) => i === 0 ? { ...v, price: val } : v) : [{ id: Date.now(), name: 'Default', price: val, salePrice: prev.salePrice || '', stock: prev.stock || '0', sku: prev.sku || '' }]
                                                            }));
                                                        }}
                                                        className="w-full px-4 py-2.5 bg-slate-100 border-none rounded-xl text-sm font-bold outline-none ring-primary/5 focus:ring-2"
                                                        placeholder="e.g. 250"
                                                    />
                                                </div>
                                                <div className="space-y-1.5 flex flex-col">
                                                    <label className="text-[9px] font-bold text-brand-600 uppercase tracking-widest ml-1">Selling / Discounted Price (₹)</label>
                                                    <input
                                                        type="number"
                                                        min="0"
                                                        value={formData.salePrice}
                                                        onChange={(e) => {
                                                            const val = e.target.value;
                                                            setFormData((prev) => ({
                                                                ...prev,
                                                                salePrice: val,
                                                                variants: prev.variants?.length > 0 ? prev.variants.map((v, i) => i === 0 ? { ...v, salePrice: val } : v) : [{ id: Date.now(), name: 'Default', price: prev.price || '', salePrice: val, stock: prev.stock || '0', sku: prev.sku || '' }]
                                                            }));
                                                        }}
                                                        className="w-full px-4 py-2.5 bg-slate-100 border-none rounded-xl text-sm font-bold outline-none ring-primary/5 focus:ring-2 text-brand-700"
                                                        placeholder="e.g. 220"
                                                    />
                                                </div>
                                            </div>

                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                                <div className="space-y-1.5 flex flex-col">
                                                    <label className="text-[9px] font-bold text-slate-400 uppercase tracking-widest ml-1">Unit / Measurement</label>
                                                    <select
                                                        value={formData.unit}
                                                        onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
                                                        className="w-full px-4 py-2.5 bg-slate-100 border-none rounded-xl text-sm font-semibold outline-none ring-primary/5 focus:ring-2 cursor-pointer"
                                                    >
                                                        <option value="packet">Packet (pkt)</option>
                                                        <option value="kg">Kilogram (kg)</option>
                                                        <option value="gm">Gram (gm)</option>
                                                        <option value="liter">Liter (L)</option>
                                                        <option value="ml">Milliliter (ml)</option>
                                                        <option value="piece">Piece (pc)</option>
                                                        <option value="box">Box</option>
                                                        <option value="bottle">Bottle</option>
                                                    </select>
                                                </div>
                                                <div className="space-y-1.5 flex flex-col">
                                                    <label className="text-[9px] font-bold text-slate-400 uppercase tracking-widest ml-1">Net Weight / Quantity</label>
                                                    <input
                                                        value={formData.weight}
                                                        onChange={(e) => setFormData({ ...formData, weight: e.target.value })}
                                                        className="w-full px-4 py-2.5 bg-slate-100 border-none rounded-xl text-sm font-semibold outline-none ring-primary/5 focus:ring-2"
                                                        placeholder="e.g. 5 kg, 500 gm, 1 L"
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    {modalTab === 'category' && (
                                        <div className="ds-section-spacing animate-in fade-in slide-in-from-right-2 duration-300">
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                                <div className="space-y-1.5 flex flex-col">
                                                    <label className="text-[9px] font-bold text-slate-400 uppercase tracking-widest ml-1">Main Group (Header) <span className="text-rose-500">*</span></label>
                                                    <select
                                                        value={formData.header}
                                                        onChange={(e) => setFormData({ ...formData, header: e.target.value, categoryId: '', subcategoryId: '' })}
                                                        className="w-full px-4 py-2.5 bg-slate-100 border-none rounded-xl text-sm font-bold outline-none cursor-pointer"
                                                    >
                                                        <option value="">Select Main Group</option>
                                                        {categories.map(h => <option key={h._id} value={h._id}>{h.name}</option>)}
                                                    </select>
                                                </div>
                                                <div className="space-y-1.5 flex flex-col">
                                                    <label className="text-[9px] font-bold text-slate-400 uppercase tracking-widest ml-1">Specific Category <span className="text-rose-500">*</span></label>
                                                    <select
                                                        value={formData.categoryId}
                                                        onChange={(e) => setFormData({ ...formData, categoryId: e.target.value, subcategoryId: '' })}
                                                        disabled={!formData.header}
                                                        className="w-full px-4 py-2.5 bg-slate-100 border-none rounded-xl text-sm font-bold outline-none cursor-pointer disabled:opacity-50"
                                                    >
                                                        <option value="">Select Category</option>
                                                        {categories.find(h => h._id === formData.header)?.children?.map(c => (
                                                            <option key={c._id} value={c._id}>{c.name}</option>
                                                        ))}
                                                    </select>
                                                </div>
                                            </div>
                                            <div className="space-y-1.5 flex flex-col">
                                                <label className="text-[9px] font-bold text-slate-400 uppercase tracking-widest ml-1">Sub-Category <span className="text-rose-500">*</span></label>
                                                <select
                                                    value={formData.subcategoryId}
                                                    onChange={(e) => setFormData({ ...formData, subcategoryId: e.target.value })}
                                                    disabled={!formData.categoryId}
                                                    className="w-full px-4 py-2.5 bg-slate-100 border-none rounded-xl text-sm font-bold outline-none cursor-pointer disabled:opacity-50"
                                                >
                                                    <option value="">Select Sub-Category</option>
                                                    {categories.find(h => h._id === formData.header)?.children?.find(c => c._id === formData.categoryId)?.children?.map(sc => (
                                                        <option key={sc._id} value={sc._id}>{sc.name}</option>
                                                    ))}
                                                </select>
                                            </div>
                                        </div>
                                    )}

                                    {modalTab === 'highlights' && (
                                        <div className="space-y-6 animate-in fade-in slide-in-from-right-2 duration-300">
                                            <div>
                                                <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider mb-1">
                                                    Product Highlight Badges (4 Slots)
                                                </h3>
                                                <p className="text-xs text-slate-500 font-medium">
                                                    Select icons and enter custom text labels to display product highlights.
                                                </p>
                                            </div>

                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                {[0, 1, 2, 3].map((slotIdx) => {
                                                    const currentHighlight = formData.highlights?.[slotIdx] || { icon: "leaf", label: "" };
                                                    return (
                                                        <div key={slotIdx} className="bg-slate-50/85 p-4 rounded-2xl border border-slate-100 space-y-3">
                                                            <div className="flex items-center justify-between">
                                                                <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                                                                    Highlight #{slotIdx + 1}
                                                                </span>
                                                                <span className="text-xl">
                                                                    {PRESET_HIGHLIGHT_ICONS.find((i) => i.id === currentHighlight.icon)?.emoji || "🌿"}
                                                                </span>
                                                            </div>

                                                            {/* Icon Selector Grid */}
                                                            <div>
                                                                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1.5">
                                                                    Select Icon
                                                                </label>
                                                                <div className="flex flex-wrap gap-1.5 max-h-36 overflow-y-auto p-1.5 bg-white rounded-xl border border-slate-200">
                                                                    {PRESET_HIGHLIGHT_ICONS.map((ic) => (
                                                                        <button
                                                                            key={ic.id}
                                                                            type="button"
                                                                            onClick={() => {
                                                                                const nextHL = [...(formData.highlights || [])];
                                                                                nextHL[slotIdx] = { ...currentHighlight, icon: ic.id };
                                                                                setFormData({ ...formData, highlights: nextHL });
                                                                            }}
                                                                            className={cn(
                                                                                "flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all border",
                                                                                currentHighlight.icon === ic.id
                                                                                    ? "bg-slate-900 border-slate-950 text-white shadow-xs"
                                                                                    : "bg-slate-50 border-slate-100 text-slate-600 hover:bg-slate-100"
                                                                            )}
                                                                        >
                                                                            <span>{ic.emoji}</span>
                                                                            <span className="text-[10px]">{ic.name}</span>
                                                                        </button>
                                                                    ))}
                                                                </div>
                                                            </div>

                                                            {/* Title Input */}
                                                            <div>
                                                                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                                                                    Heading / Title Text
                                                                </label>
                                                                <input
                                                                    type="text"
                                                                    value={currentHighlight.label}
                                                                    onChange={(e) => {
                                                                        const nextHL = [...(formData.highlights || [])];
                                                                        nextHL[slotIdx] = { ...currentHighlight, label: e.target.value };
                                                                        setFormData({ ...formData, highlights: nextHL });
                                                                    }}
                                                                    placeholder="e.g. 100% Natural"
                                                                    className="w-full px-3.5 py-2 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 outline-none focus:ring-2 focus:ring-primary/10"
                                                                />
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    )}

                                    {modalTab === 'variants' && (
                                        <div className="space-y-6 animate-in fade-in slide-in-from-right-2 duration-300">
                                            <div className="flex items-center justify-between">
                                                <h4 className="text-sm font-bold text-slate-900">Product Variants</h4>
                                                <button
                                                    type="button"
                                                    onClick={() => setFormData({ ...formData, variants: [...formData.variants, { id: Date.now(), name: '', price: '', salePrice: '', stock: '', sku: '' }] })}
                                                    className="rounded-xl bg-rose-50 px-4 py-2 text-[10px] font-bold uppercase tracking-widest text-rose-600 transition-colors hover:bg-rose-100"
                                                >
                                                    + ADD
                                                </button>
                                            </div>
                                            <div className="space-y-3">
                                                {formData.variants.map((v, i) => (
                                                    <div key={v.id} className="rounded-3xl border border-slate-100 bg-slate-50/80 p-4 shadow-sm">
                                                        <div className="grid grid-cols-1 gap-4 md:grid-cols-5">
                                                            <div className="space-y-1.5">
                                                                <label className="ml-1 text-[8px] font-bold uppercase tracking-widest text-slate-400">Variant Name</label>
                                                                <input
                                                                    value={v.name}
                                                                    onChange={e => {
                                                                        const news = [...formData.variants];
                                                                        news[i].name = e.target.value;
                                                                        setFormData({ ...formData, variants: news });
                                                                    }}
                                                                    placeholder="500g"
                                                                    className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm outline-none ring-0 focus:border-primary/40 focus:ring-2 focus:ring-primary/10"
                                                                />
                                                            </div>
                                                            <div className="space-y-1.5">
                                                                <label className="ml-1 text-[8px] font-bold uppercase tracking-widest text-slate-400">Price</label>
                                                                <input
                                                                    type="number"
                                                                    value={v.price}
                                                                    onChange={e => {
                                                                        const val = e.target.value;
                                                                        const news = [...formData.variants];
                                                                        news[i].price = val;
                                                                        setFormData(prev => ({
                                                                            ...prev,
                                                                            variants: news,
                                                                            price: i === 0 ? val : (prev.price || val)
                                                                        }));
                                                                    }}
                                                                    placeholder="200"
                                                                    className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm outline-none ring-0 focus:border-primary/40 focus:ring-2 focus:ring-primary/10"
                                                                />
                                                            </div>
                                                            <div className="space-y-1.5">
                                                                <label className="ml-1 text-[8px] font-bold uppercase tracking-widest text-brand-500">Sale Price</label>
                                                                <input
                                                                    type="number"
                                                                    value={v.salePrice}
                                                                    onChange={e => {
                                                                        const val = e.target.value;
                                                                        const news = [...formData.variants];
                                                                        news[i].salePrice = val;
                                                                        setFormData(prev => ({
                                                                            ...prev,
                                                                            variants: news,
                                                                            salePrice: i === 0 ? val : (prev.salePrice || val)
                                                                        }));
                                                                    }}
                                                                    placeholder="150"
                                                                    className="w-full rounded-xl border border-brand-200 bg-brand-50/60 px-4 py-2.5 text-sm outline-none ring-0 focus:border-brand-300 focus:ring-2 focus:ring-brand-100"
                                                                />
                                                            </div>
                                                            <div className="space-y-1.5">
                                                                <label className="ml-1 text-[8px] font-bold uppercase tracking-widest text-slate-400">Stock</label>
                                                                <input
                                                                    type="number"
                                                                    value={v.stock}
                                                                    onChange={e => {
                                                                        const val = e.target.value;
                                                                        const news = [...formData.variants];
                                                                        news[i].stock = val;
                                                                        setFormData(prev => ({
                                                                            ...prev,
                                                                            variants: news,
                                                                            stock: i === 0 ? val : (prev.stock || val)
                                                                        }));
                                                                    }}
                                                                    placeholder="50"
                                                                    className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm outline-none ring-0 focus:border-primary/40 focus:ring-2 focus:ring-primary/10"
                                                                />
                                                            </div>
                                                            <div className="space-y-1.5">
                                                                <label className="ml-1 text-[8px] font-bold uppercase tracking-widest text-slate-400">SKU</label>
                                                                <div className="flex items-start gap-2">
                                                                    <input
                                                                        value={v.sku}
                                                                        onChange={e => {
                                                                            const val = e.target.value;
                                                                            const news = [...formData.variants];
                                                                            news[i].sku = val;
                                                                            setFormData(prev => ({
                                                                                ...prev,
                                                                                variants: news,
                                                                                sku: i === 0 ? val : (prev.sku || val)
                                                                            }));
                                                                        }}
                                                                        placeholder="mango-001"
                                                                        className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm outline-none ring-0 focus:border-primary/40 focus:ring-2 focus:ring-primary/10"
                                                                    />
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => setFormData({ ...formData, variants: formData.variants.filter((_, idx) => idx !== i) })}
                                                                        className="mt-0.5 rounded-xl p-2 text-rose-500 transition-colors hover:bg-rose-50"
                                                                        aria-label="Delete variant"
                                                                    >
                                                                        <HiOutlineTrash className="h-4 w-4" />
                                                                    </button>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {modalTab === 'media' && (
                                        <div className="ds-section-spacing animate-in fade-in slide-in-from-right-2 duration-300">
                                            <div className="space-y-3">
                                                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Main Cover Photo</label>
                                                <div className="flex flex-col md:flex-row items-start gap-6">
                                                    <div className="w-48 aspect-square rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50 flex flex-col items-center justify-center group hover:border-primary hover:bg-primary/5 transition-all cursor-pointer overflow-hidden relative">
                                                        <input
                                                            type="file"
                                                            accept="image/*"
                                                            className="absolute inset-0 opacity-0 cursor-pointer z-10"
                                                            onChange={(e) => handleImageUpload(e, 'main')}
                                                        />
                                                        {formData.mainImage ? (
                                                            <img src={formData.mainImage} alt="Main Preview" className="w-full h-full object-cover" />
                                                        ) : (
                                                            <div className="flex flex-col items-center">
                                                                <HiOutlinePhoto className="h-10 w-10 text-slate-200" />
                                                                <p className="text-[10px] text-slate-400 font-bold mt-2">UPLOAD</p>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="space-y-3 pt-2">
                                                <div className="flex items-center justify-between gap-4">
                                                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Gallery Photos</label>
                                                    <label className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-900 text-white text-[10px] font-bold uppercase tracking-widest cursor-pointer hover:-translate-y-0.5 transition-all">
                                                        <HiOutlinePhoto className="h-4 w-4" />
                                                        <span>Add Photos</span>
                                                        <input
                                                            type="file"
                                                            multiple
                                                            accept="image/*"
                                                            className="hidden"
                                                            onChange={(e) => handleImageUpload(e, 'gallery')}
                                                        />
                                                    </label>
                                                </div>

                                                <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3">
                                                    {(formData.galleryImages || []).length > 0 ? (
                                                        formData.galleryImages.map((image, index) => (
                                                            <div key={`${image}-${index}`} className="group relative aspect-square rounded-2xl overflow-hidden border border-slate-200 bg-slate-50 shadow-sm">
                                                                <img src={image} alt={`Gallery ${index + 1}`} className="h-full w-full object-cover" />
                                                                <button
                                                                    type="button"
                                                                    onClick={() => setFormData({
                                                                        ...formData,
                                                                        galleryImages: formData.galleryImages.filter((_, i) => i !== index)
                                                                    })}
                                                                    className="absolute top-2 right-2 p-2 rounded-full bg-white/90 text-rose-500 shadow-md opacity-0 group-hover:opacity-100 transition-all"
                                                                >
                                                                    <HiOutlineTrash className="h-4 w-4" />
                                                                </button>
                                                            </div>
                                                        ))
                                                    ) : (
                                                        <div className="col-span-full rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-10 text-center">
                                                            <p className="text-xs font-medium text-slate-400">No gallery photos added yet.</p>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>

                                            <p className="text-[10px] text-slate-400 font-medium italic text-center pt-4 border-t border-slate-50 outline-none">
                                                Quick Tip: Multiple photos help users trust your products more!
                                            </p>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Modal Footer */}
                            <div className="p-6 border-t border-slate-100 bg-slate-50/50 flex items-center justify-end gap-3">
                                <button
                                    onClick={handleCloseModal}
                                    className="px-6 py-2.5 rounded-xl text-xs font-bold text-slate-400 hover:bg-slate-100"
                                >
                                    CLOSE
                                </button>
                                <button
                                    onClick={handleSave}
                                    disabled={isSaving}
                                    className="bg-slate-900 text-white px-10 py-2.5 rounded-xl text-xs font-bold shadow-xl hover:-translate-y-0.5 transition-all disabled:opacity-50"
                                >
                                    {isSaving ? 'SAVING...' : 'SAVE CHANGES'}
                                </button>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            <Modal
                isOpen={isRejectModalOpen}
                onClose={() => {
                    if (moderatingActionId === `reject:${itemToReject?._id}`) return;
                    setIsRejectModalOpen(false);
                    setItemToReject(null);
                    setRejectionNote('');
                }}
                title="Reject Product"
                size="sm"
                footer={
                    <>
                        <button
                            type="button"
                            onClick={() => {
                                setIsRejectModalOpen(false);
                                setItemToReject(null);
                                setRejectionNote('');
                            }}
                            disabled={moderatingActionId === `reject:${itemToReject?._id}`}
                            className="px-4 py-2 text-xs font-bold text-slate-500 hover:text-slate-700 transition-colors disabled:opacity-50"
                        >
                            CANCEL
                        </button>
                        <button
                            type="button"
                            onClick={confirmReject}
                            disabled={moderatingActionId === `reject:${itemToReject?._id}`}
                            className="px-6 py-2 bg-rose-600 text-white rounded-xl text-xs font-bold shadow-lg shadow-rose-100 hover:bg-rose-700 transition-all active:scale-95 disabled:opacity-50"
                        >
                            {moderatingActionId === `reject:${itemToReject?._id}` ? 'REJECTING...' : 'REJECT PRODUCT'}
                        </button>
                    </>
                }
            >
                <div className="space-y-5 py-2">
                    <div className="rounded-2xl bg-rose-50 border border-rose-100 px-4 py-3">
                        <p className="text-xs font-black text-slate-900 line-clamp-2">
                            {itemToReject?.name || 'Selected product'}
                        </p>
                        <p className="mt-1 text-[10px] font-bold uppercase tracking-widest text-rose-500">
                            Rejection reason required
                        </p>
                    </div>
                    <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                            Reason for seller
                        </label>
                        <textarea
                            value={rejectionNote}
                            onChange={(e) => setRejectionNote(e.target.value)}
                            rows={5}
                            autoFocus
                            placeholder="Tell the seller what needs to be fixed before resubmitting..."
                            className="w-full resize-none rounded-2xl bg-slate-100 px-4 py-3 text-sm font-semibold text-slate-800 outline-none transition-all focus:ring-2 focus:ring-rose-100"
                        />
                    </div>
                </div>
            </Modal>

            {/* Delete Confirmation Modal */}
            <Modal
                isOpen={isDeleteModalOpen}
                onClose={() => !isDeleting && setIsDeleteModalOpen(false)}
                title="Confirm Deletion"
                size="sm"
                footer={
                    <>
                        <button
                            onClick={() => setIsDeleteModalOpen(false)}
                            disabled={isDeleting}
                            className="px-4 py-2 text-xs font-bold text-slate-500 hover:text-slate-700 transition-colors disabled:opacity-50"
                        >
                            CANCEL
                        </button>
                        <button
                            onClick={confirmDelete}
                            disabled={isDeleting}
                            className="px-6 py-2 bg-rose-600 text-white rounded-xl text-xs font-bold shadow-lg shadow-rose-100 hover:bg-rose-700 transition-all active:scale-95 disabled:opacity-50"
                        >
                            {isDeleting ? 'DELETING...' : 'DELETE PRODUCT'}
                        </button>
                    </>
                }
            >
                <div className="flex flex-col items-center text-center py-4">
                    <div className="h-16 w-16 bg-rose-50 rounded-full flex items-center justify-center mb-4">
                        <HiOutlineExclamationCircle className="h-10 w-10 text-rose-500" />
                    </div>
                    <h3 className="text-lg font-black text-slate-900 mb-2 uppercase tracking-tight">Delete Product?</h3>
                    <p className="text-sm text-slate-500 font-medium">
                        Are you sure you want to delete <span className="font-bold text-slate-900">"{itemToDelete?.name}"</span>?
                        This action cannot be undone.
                    </p>
                </div>
            </Modal>

            {/* Delete All Confirmation Modal */}
            <Modal
                isOpen={isDeleteAllModalOpen}
                onClose={() => !isDeleting && setIsDeleteAllModalOpen(false)}
                title="Delete All Products"
                size="sm"
                footer={
                    <>
                        <button
                            onClick={() => setIsDeleteAllModalOpen(false)}
                            disabled={isDeleting}
                            className="px-4 py-2 text-xs font-bold text-slate-500 hover:text-slate-700 transition-colors disabled:opacity-50"
                        >
                            CANCEL
                        </button>
                        <button
                            onClick={confirmDeleteAll}
                            disabled={isDeleting}
                            className="px-6 py-2 bg-rose-600 text-white rounded-xl text-xs font-bold shadow-lg shadow-rose-100 hover:bg-rose-700 transition-all active:scale-95 disabled:opacity-50"
                        >
                            {isDeleting ? 'DELETING ALL...' : 'DELETE ALL PRODUCTS'}
                        </button>
                    </>
                }
            >
                <div className="flex flex-col items-center text-center py-4">
                    <div className="h-16 w-16 bg-rose-50 rounded-full flex items-center justify-center mb-4">
                        <HiOutlineTrash className="h-10 w-10 text-rose-600" />
                    </div>
                    <h3 className="text-lg font-black text-slate-900 mb-2 uppercase tracking-tight">Delete All Products?</h3>
                    <p className="text-sm text-slate-500 font-medium leading-relaxed">
                        Are you sure you want to delete <span className="font-bold text-rose-600">ALL {total} products</span>?
                        This will permanently remove all products from the store and database. This action <span className="font-bold text-slate-900">cannot be undone</span>.
                    </p>
                </div>
            </Modal>

            {/* Viewing Variants Modal */}
            <Modal
                isOpen={isVariantsViewModalOpen}
                onClose={() => setIsVariantsViewModalOpen(false)}
                title="Product Variants Details"
                size="lg"
            >
                <div className="py-2">
                    <div className="flex items-center gap-4 mb-6 p-4 bg-slate-50 rounded-2xl border border-slate-100">
                        <div className="h-16 w-16 bg-white rounded-xl shadow-sm overflow-hidden flex items-center justify-center border border-slate-100">
                            {viewingVariants?.mainImage || viewingVariants?.images?.[0] || viewingVariants?.galleryImages?.[0] ? (
                                <img src={viewingVariants.mainImage || viewingVariants.images?.[0] || viewingVariants.galleryImages?.[0]} alt="" className="h-full w-full object-cover" />
                            ) : (
                                <HiOutlineCube className="h-8 w-8 text-slate-200" />
                            )}
                        </div>
                        <div>
                            <h3 className="text-lg font-black text-slate-900 leading-tight">{viewingVariants?.name}</h3>
                            <div className="flex items-center gap-2 mt-1">
                                <Badge variant="primary" className="text-[8px] font-bold uppercase tracking-widest px-1.5 py-0.5">{viewingVariants?.categoryId?.name || 'Category'}</Badge>
                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Master SKU: {viewingVariants?.sku || viewingVariants?._id?.slice(-6).toUpperCase() || 'N/A'}</span>
                            </div>
                        </div>
                    </div>

                    <div className="overflow-hidden rounded-2xl border border-slate-100 shadow-sm bg-white">
                        <table className="w-full text-left">
                            <thead>
                                <tr className="bg-slate-50/50 border-b border-slate-100">
                                    <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Variant Specification</th>
                                    <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Unit Price</th>
                                    <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Available Stock</th>
                                    <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Variant SKU</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-50">
                                {viewingVariants?.variants?.map((v, idx) => (
                                    <tr key={idx} className="hover:bg-slate-50/30 transition-all cursor-default">
                                        <td className="px-6 py-4">
                                            <div className="flex flex-col">
                                                <span className="text-xs font-black text-slate-700 group-hover:text-primary transition-colors">{v.name}</span>
                                                <span className="text-[9px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">Variation {idx + 1}</span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-center">
                                            <div className="flex flex-col items-center">
                                                <span className={cn("text-xs font-bold", v.salePrice > 0 ? "text-slate-400 line-through scale-90" : "text-slate-900")}>₹{v.price}</span>
                                                {v.salePrice > 0 && <span className="text-xs font-bold text-brand-600">₹{v.salePrice}</span>}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-center">
                                            <Badge variant={v.stock === 0 ? "rose" : v.stock <= 10 ? "amber" : "emerald"} className="text-[10px] font-black uppercase tracking-widest px-2 shadow-sm">
                                                {v.stock === 0 ? 'OUT OF STOCK' : `${v.stock} UNITS`}
                                            </Badge>
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <span className="text-[10px] font-bold text-slate-400 font-mono tracking-tighter uppercase bg-slate-100 px-2 py-1 rounded-lg">
                                                {v.sku || 'N/A'}
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    <div className="mt-8 flex justify-end">
                        <button
                            onClick={() => setIsVariantsViewModalOpen(false)}
                            className="bg-slate-900 text-white px-8 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-xl hover:-translate-y-0.5 transition-all active:scale-95"
                        >
                            CLOSE VIEWER
                        </button>
                    </div>
                </div>
            </Modal>

        </div>
    );
};

export default ProductManagement;

