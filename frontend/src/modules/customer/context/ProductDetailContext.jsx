import React, { createContext, useContext, useState, useMemo, useEffect, useRef, useCallback } from 'react';

const ProductDetailContext = createContext(null);

export const useProductDetail = () => {
    const context = useContext(ProductDetailContext);
    if (!context) {
        // console.warn('useProductDetail used outside Provider');
        return {};
    }
    return context;
};

export const ProductDetailProvider = ({ children }) => {
    const [selectedProduct, setSelectedProduct] = useState(null);
    const [isOpen, setIsOpen] = useState(false);
    const isHistoryPushedRef = useRef(false);

    const closeProduct = useCallback((options = {}) => {
        setIsOpen(false);
        // Delay clearing product to allow close animation to finish
        setTimeout(() => setSelectedProduct(null), 300);

        if (isHistoryPushedRef.current) {
            isHistoryPushedRef.current = false;
            if (!options?.fromPopState && !options?.fromNavigation && window.history.state?.isProductDetailOpen) {
                try {
                    window.history.back();
                } catch (e) {}
            }
        }
    }, []);

    const openProduct = useCallback((product) => {
        setSelectedProduct(product);
        setIsOpen(true);

        try {
            if (!window.history.state?.isProductDetailOpen) {
                window.history.pushState({ ...window.history.state, isProductDetailOpen: true }, '');
                isHistoryPushedRef.current = true;
            }
        } catch (e) {
            // PushState fallback in restricted webviews
        }
    }, []);

    // Intercept hardware/gesture back button event from Capacitor
    useEffect(() => {
        if (!isOpen) return;

        const handleAppBack = (e) => {
            e.preventDefault();
            closeProduct();
        };

        window.addEventListener('app:back', handleAppBack);
        return () => window.removeEventListener('app:back', handleAppBack);
    }, [isOpen, closeProduct]);

    // Handle browser/webview popstate (gesture back)
    useEffect(() => {
        if (!isOpen) return;

        const handlePopState = () => {
            if (isOpen) {
                closeProduct({ fromPopState: true });
            }
        };

        window.addEventListener('popstate', handlePopState);
        return () => window.removeEventListener('popstate', handlePopState);
    }, [isOpen, closeProduct]);

    const value = useMemo(
        () => ({ selectedProduct, isOpen, openProduct, closeProduct }),
        [selectedProduct, isOpen, openProduct, closeProduct]
    );

    return (
        <ProductDetailContext.Provider value={value}>
            {children}
        </ProductDetailContext.Provider>
    );
};

