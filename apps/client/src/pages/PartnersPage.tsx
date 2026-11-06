import { useState, useMemo, useEffect } from 'react';
import { PageHeader } from '../components/PageHeader';
import { useToast } from '../components/ToastContext';
import { api } from '../lib/api';

// Types pour le module partenaires
export interface FinancialPartner {
  id: string;
  name: string;
  phone: string;
  email: string;
  capitalInvested: number;
  profitSharePercent: number; // ex: 20%
  paymentMethod: 'MOBILE_MONEY' | 'BANK_TRANSFER' | 'CASH';
  accountDetails: string;
  startDate: string;
  status: 'ACTIVE' | 'PAUSED';
  notes?: string;
  isCurrentMonthPaid?: boolean;
  unpaidArrears?: number; // Arriérés des mois antérieurs non payés
}

export interface ConsignmentProduct {
  id: string;
  productName: string;
  category: string;
  sku: string;
  partnerId: string;
  partnerName: string;
  partnerPhone: string;
  partnerEmail: string;
  qtyDeposited: number;
  qtySold: number;
  qtyPaid: number; // Quantité dont le reversement au partenaire a déjà été réglé
  unitSellingPrice: number;
  shopCommissionPercent: number; // ex: 15% pour la boutique, 85% pour le partenaire
  depositDate: string;
  status: 'IN_STOCK' | 'PARTIALLY_SOLD' | 'SOLD_OUT';
}

export interface PartnerPayout {
  id: string;
  partnerId: string;
  partnerName: string;
  partnerType: 'FINANCIAL' | 'CONSIGNMENT';
  amount: number;
  payoutDate: string;
  periodLabel: string;
  paymentMethod: string;
  reference: string;
  status: 'PAID' | 'PENDING';
  receiptNumber: string;
  notes?: string;
}

// Données d'exemple avec gestion des arriérés et des cycles
const INITIAL_FINANCIAL_PARTNERS: FinancialPartner[] = [
  {
    id: 'fp-1',
    name: 'El Hadj Oumar Diallo',
    phone: '+226 70 12 34 56',
    email: 'oumar.diallo@invest-partners.bf',
    capitalInvested: 15000000,
    profitSharePercent: 25,
    paymentMethod: 'BANK_TRANSFER',
    accountDetails: 'Coris Bank Intl — BF023 01001 02456789012 34',
    startDate: '2025-01-15',
    status: 'ACTIVE',
    notes: 'Apport de capital pour extension magasin principal.',
    isCurrentMonthPaid: false,
    unpaidArrears: 0,
  },
  {
    id: 'fp-2',
    name: 'Mme Salimata Ouédraogo',
    phone: '+226 76 89 01 23',
    email: 'salimata.o@innovcap.com',
    capitalInvested: 8000000,
    profitSharePercent: 15,
    paymentMethod: 'MOBILE_MONEY',
    accountDetails: 'Orange Money: +226 76 89 01 23',
    startDate: '2025-06-01',
    status: 'ACTIVE',
    notes: 'Investissement dédié au fonds de roulement accessoires.',
    isCurrentMonthPaid: false,
    unpaidArrears: 650000, // Mois précédent non payé (report en crédit à part)
  },
  {
    id: 'fp-3',
    name: 'Synergie Invest Sahel SAS',
    phone: '+226 25 30 40 50',
    email: 'contact@synergie-invest.bf',
    capitalInvested: 10000000,
    profitSharePercent: 18,
    paymentMethod: 'BANK_TRANSFER',
    accountDetails: 'Ecobank BF — BF084 01015 11223344556 78',
    startDate: '2025-09-10',
    status: 'ACTIVE',
    notes: 'Partenaire institutionnel rayon électroménager.',
    isCurrentMonthPaid: false,
    unpaidArrears: 0,
  },
];

const INITIAL_CONSIGNMENT_PRODUCTS: ConsignmentProduct[] = [
  {
    id: 'cp-1',
    productName: 'iPhone 15 Pro Max 256GB Titane Naturel',
    category: 'Téléphonie & High-Tech',
    sku: 'IPH-15PM-256',
    partnerId: 'cp-p1',
    partnerName: 'M. Ibrahim Traoré (Import Dubaï)',
    partnerPhone: '+226 78 44 55 66',
    partnerEmail: 'ibrahim.traore@dubai-tech.net',
    qtyDeposited: 10,
    qtySold: 7,
    qtyPaid: 0, // 7 vendus à reverser
    unitSellingPrice: 850000,
    shopCommissionPercent: 12,
    depositDate: '2026-09-15',
    status: 'PARTIALLY_SOLD',
  },
  {
    id: 'cp-2',
    productName: 'MacBook Air M2 13" 512GB Gris Sidéral',
    category: 'Ordinateurs & Portables',
    sku: 'MBA-M2-512',
    partnerId: 'cp-p2',
    partnerName: 'Cabinet Soft & Gadgets France',
    partnerPhone: '+33 6 12 34 56 78',
    partnerEmail: 'direction@softgadgets.fr',
    qtyDeposited: 6,
    qtySold: 6,
    qtyPaid: 6, // Entièrement payé et soldé !
    unitSellingPrice: 720000,
    shopCommissionPercent: 15,
    depositDate: '2026-08-20',
    status: 'SOLD_OUT',
  },
  {
    id: 'cp-3',
    productName: 'Téléviseur Samsung 65" QLED 4K Smart TV',
    category: 'Électroménager & TV',
    sku: 'SAM-65QLED-4K',
    partnerId: 'cp-p3',
    partnerName: 'Moussa Kaboré (Electro-Import)',
    partnerPhone: '+226 71 99 88 77',
    partnerEmail: 'moussa.kabore@electro-bf.com',
    qtyDeposited: 4,
    qtySold: 2,
    qtyPaid: 0, // 2 vendus à reverser
    unitSellingPrice: 480000,
    shopCommissionPercent: 10,
    depositDate: '2026-10-01',
    status: 'PARTIALLY_SOLD',
  },
  {
    id: 'cp-4',
    productName: 'PlayStation 5 Édition Standard + 2 Manettes',
    category: 'Jeux Vidéo & Consoles',
    sku: 'PS5-STD-BUNDLE',
    partnerId: 'cp-p1',
    partnerName: 'M. Ibrahim Traoré (Import Dubaï)',
    partnerPhone: '+226 78 44 55 66',
    partnerEmail: 'ibrahim.traore@dubai-tech.net',
    qtyDeposited: 8,
    qtySold: 5,
    qtyPaid: 3, // 3 payés, 2 en attente de reversement
    unitSellingPrice: 420000,
    shopCommissionPercent: 12,
    depositDate: '2026-10-05',
    status: 'PARTIALLY_SOLD',
  },
];

const INITIAL_PAYOUTS: PartnerPayout[] = [
  {
    id: 'pay-1',
    partnerId: 'fp-1',
    partnerName: 'El Hadj Oumar Diallo',
    partnerType: 'FINANCIAL',
    amount: 937500,
    payoutDate: '2026-09-30',
    periodLabel: 'Dividendes Septembre 2026',
    paymentMethod: 'Virement Coris Bank',
    reference: 'VIR-CORIS-202609-089',
    status: 'PAID',
    receiptNumber: 'QUITT-2026-09-001',
    notes: 'Règlement de clôture mensuelle régulier.',
  },
  {
    id: 'pay-2',
    partnerId: 'cp-p2',
    partnerName: 'Cabinet Soft & Gadgets France',
    partnerType: 'CONSIGNMENT',
    amount: 3672000,
    payoutDate: '2026-10-02',
    periodLabel: 'Reversement 6x MacBook Air M2',
    paymentMethod: 'Virement Swift',
    reference: 'SWIFT-FR76-90812',
    status: 'PAID',
    receiptNumber: 'DEPOT-SOLDE-2026-042',
    notes: 'Lot entièrement soldé et réinitialisé.',
  },
];

export function PartnersPage() {
  const { addToast } = useToast();

  const [activeTab, setActiveTab] = useState<'simulation' | 'financial' | 'consignment' | 'payouts'>('simulation');

  // Persistence local storage
  const [financialPartners, setFinancialPartners] = useState<FinancialPartner[]>(() => {
    try {
      const saved = localStorage.getItem('vtm_financial_partners');
      return saved ? JSON.parse(saved) : INITIAL_FINANCIAL_PARTNERS;
    } catch {
      return INITIAL_FINANCIAL_PARTNERS;
    }
  });

  const [consignmentProducts, setConsignmentProducts] = useState<ConsignmentProduct[]>(() => {
    try {
      const saved = localStorage.getItem('vtm_consignment_products');
      return saved ? JSON.parse(saved) : INITIAL_CONSIGNMENT_PRODUCTS;
    } catch {
      return INITIAL_CONSIGNMENT_PRODUCTS;
    }
  });

  const [payouts, setPayouts] = useState<PartnerPayout[]>(() => {
    try {
      const saved = localStorage.getItem('vtm_partner_payouts');
      return saved ? JSON.parse(saved) : INITIAL_PAYOUTS;
    } catch {
      return INITIAL_PAYOUTS;
    }
  });

  // Gestion des dates et du verrouillage de fin de mois
  const todayDate = new Date();
  const currentDay = todayDate.getDate();
  const daysInMonth = new Date(todayDate.getFullYear(), todayDate.getMonth() + 1, 0).getDate();
  const currentMonthLabel = todayDate.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });

  // Verrouillage de fin de mois : autorisé à partir du 25 du mois, sauf si déverrouillé par l'admin
  const [forceUnlock, setForceUnlock] = useState(false);
  const isEndOfMonthPayable = currentDay >= 25 || forceUnlock;

  // Charges et Chiffre d'Affaires pour le calcul réel du bénéfice net
  const [revenue, setRevenue] = useState<number>(18500000);
  const [cogs, setCogs] = useState<number>(10200000);
  const [salaryExpense, setSalaryExpense] = useState<number>(1800000);
  const [rentExpense, setRentExpense] = useState<number>(650000);
  const [electricityExpense, setElectricityExpense] = useState<number>(250000);
  const [miscExpense, setMiscExpense] = useState<number>(350000);
  const [isRevenueAutoDetected, setIsRevenueAutoDetected] = useState(false);

  // Détection automatique du Chiffre d'Affaires Brut (CA) du mois depuis les ventes réelles
  useEffect(() => {
    api.get<Array<{ id: string; createdAt: string; grandTotal: string }>>('/sales')
      .then((sales: Array<{ id: string; createdAt: string; grandTotal: string }>) => {
        const now = new Date();
        const curM = now.getMonth();
        const curY = now.getFullYear();
        const thisMonthSales = (sales || []).filter((s: { id: string; createdAt: string; grandTotal: string }) => {
          const d = new Date(s.createdAt);
          return d.getMonth() === curM && d.getFullYear() === curY;
        });
        const totalCA = thisMonthSales.reduce((acc: number, s: { id: string; createdAt: string; grandTotal: string }) => acc + (Number(s.grandTotal) || 0), 0);
        if (totalCA > 0) {
          setRevenue(totalCA);
          setIsRevenueAutoDetected(true);
        }
      })
      .catch(() => {});
  }, []);

  // Modals de création et d'édition
  const [showAddPartnerModal, setShowAddPartnerModal] = useState(false);
  const [editingPartner, setEditingPartner] = useState<FinancialPartner | null>(null);

  const [showAddConsignmentModal, setShowAddConsignmentModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState<ConsignmentProduct | null>(null);

  const [showPayoutModal, setShowPayoutModal] = useState(false);
  const [selectedProductDetail, setSelectedProductDetail] = useState<ConsignmentProduct | null>(null);
  const [deletingConfirmTarget, setDeletingConfirmTarget] = useState<{ id: string; name: string; type: 'PARTNER' | 'PRODUCT' } | null>(null);

  // Cible de paiement
  const [payoutTarget, setPayoutTarget] = useState<{
    id: string;
    name: string;
    type: 'FINANCIAL' | 'CONSIGNMENT';
    currentMonthAmount: number;
    arrearsAmount: number;
    totalAmount: number;
    productId?: string;
  } | null>(null);

  const [selectedPayoutMode, setSelectedPayoutMode] = useState<'CURRENT_MONTH' | 'ARREARS_ONLY' | 'ALL'>('ALL');
  const [payoutMethod, setPayoutMethod] = useState('Virement Bancaire');
  const [payoutRef, setPayoutRef] = useState('');
  const [payoutPeriod, setPayoutPeriod] = useState(`Fin de Mois — ${currentMonthLabel}`);

  // Helpers de sauvegarde
  const saveFinancialPartners = (list: FinancialPartner[]) => {
    setFinancialPartners(list);
    localStorage.setItem('vtm_financial_partners', JSON.stringify(list));
  };

  const saveConsignmentProducts = (list: ConsignmentProduct[]) => {
    setConsignmentProducts(list);
    localStorage.setItem('vtm_consignment_products', JSON.stringify(list));
  };

  const savePayouts = (list: PartnerPayout[]) => {
    setPayouts(list);
    localStorage.setItem('vtm_partner_payouts', JSON.stringify(list));
  };

  // Calcul du Bénéfice Net Réel Distribuable
  const totalOperatingExpenses = useMemo(() => {
    return salaryExpense + rentExpense + electricityExpense + miscExpense;
  }, [salaryExpense, rentExpense, electricityExpense, miscExpense]);

  const grossMargin = useMemo(() => {
    return Math.max(0, revenue - cogs);
  }, [revenue, cogs]);

  const netRealProfit = useMemo(() => {
    return Math.max(0, grossMargin - totalOperatingExpenses);
  }, [grossMargin, totalOperatingExpenses]);

  // Prorata journalier en cours de mois
  const dailyEstimatedProfit = useMemo(() => {
    return Math.round((netRealProfit / daysInMonth) * currentDay);
  }, [netRealProfit, daysInMonth, currentDay]);

  // Pourcentages des partenaires
  const totalPartnerSharePercent = useMemo(() => {
    return financialPartners
      .filter((p) => p.status === 'ACTIVE')
      .reduce((sum, p) => sum + p.profitSharePercent, 0);
  }, [financialPartners]);

  const shopRetainedPercent = Math.max(0, 100 - totalPartnerSharePercent);

  const totalPartnersPayout = useMemo(() => {
    return Math.round((netRealProfit * totalPartnerSharePercent) / 100);
  }, [netRealProfit, totalPartnerSharePercent]);

  const shopRetainedProfit = useMemo(() => {
    return Math.max(0, netRealProfit - totalPartnersPayout);
  }, [netRealProfit, totalPartnersPayout]);

  const totalCapitalInvested = useMemo(() => {
    return financialPartners.reduce((acc, p) => acc + p.capitalInvested, 0);
  }, [financialPartners]);

  const totalArrearsDue = useMemo(() => {
    return financialPartners.reduce((acc, p) => acc + (p.unpaidArrears || 0), 0);
  }, [financialPartners]);

  // Statistiques dépôt-vente
  const consignmentStats = useMemo(() => {
    let totalDepositedValue = 0;
    let totalSoldAmount = 0;
    let totalDueToPartners = 0;
    let totalAlreadyPaidToPartners = 0;

    for (const prod of consignmentProducts) {
      const totalVal = prod.qtyDeposited * prod.unitSellingPrice;
      const soldVal = prod.qtySold * prod.unitSellingPrice;
      const unpaidQty = Math.max(0, prod.qtySold - prod.qtyPaid);
      const due = unpaidQty * prod.unitSellingPrice * (1 - prod.shopCommissionPercent / 100);
      const paid = prod.qtyPaid * prod.unitSellingPrice * (1 - prod.shopCommissionPercent / 100);

      totalDepositedValue += totalVal;
      totalSoldAmount += soldVal;
      totalDueToPartners += due;
      totalAlreadyPaidToPartners += paid;
    }

    return { totalDepositedValue, totalSoldAmount, totalDueToPartners, totalAlreadyPaidToPartners };
  }, [consignmentProducts]);

  const formatMoney = (val: number) => {
    return `${Math.round(val).toLocaleString('fr-FR')} FCFA`;
  };

  // Form states pour ajout/édition partenaire financier
  const [partnerForm, setPartnerForm] = useState<{
    name: string;
    phone: string;
    email: string;
    capital: number;
    share: number;
    method: 'MOBILE_MONEY' | 'BANK_TRANSFER' | 'CASH';
    account: string;
    notes: string;
    status: 'ACTIVE' | 'PAUSED';
    arrears: number;
  }>({
    name: '',
    phone: '',
    email: '',
    capital: 5000000,
    share: 10,
    method: 'BANK_TRANSFER',
    account: '',
    notes: '',
    status: 'ACTIVE',
    arrears: 0,
  });

  // Form states pour produit en dépôt-vente
  const [productForm, setProductForm] = useState<{
    productName: string;
    category: string;
    sku: string;
    partnerName: string;
    partnerPhone: string;
    partnerEmail: string;
    qtyDeposited: number;
    unitPrice: number;
    commissionPercent: number;
  }>({
    productName: '',
    category: 'High-Tech',
    sku: '',
    partnerName: '',
    partnerPhone: '',
    partnerEmail: '',
    qtyDeposited: 5,
    unitPrice: 250000,
    commissionPercent: 12,
  });

  // Ouvrir modal d'ajout de partenaire
  const handleOpenAddPartner = () => {
    setEditingPartner(null);
    setPartnerForm({
      name: '',
      phone: '',
      email: '',
      capital: 5000000,
      share: 10,
      method: 'BANK_TRANSFER',
      account: '',
      notes: '',
      status: 'ACTIVE',
      arrears: 0,
    });
    setShowAddPartnerModal(true);
  };

  // Ouvrir modal d'édition de partenaire
  const handleOpenEditPartner = (p: FinancialPartner) => {
    setEditingPartner(p);
    setPartnerForm({
      name: p.name,
      phone: p.phone,
      email: p.email,
      capital: p.capitalInvested,
      share: p.profitSharePercent,
      method: p.paymentMethod,
      account: p.accountDetails,
      notes: p.notes || '',
      status: p.status,
      arrears: p.unpaidArrears || 0,
    });
    setShowAddPartnerModal(true);
  };

  // Enregistrer partenaire (Ajout ou Modification)
  const handleSavePartnerSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!partnerForm.name.trim() || !partnerForm.phone.trim()) {
      addToast('Nom et téléphone de l’investisseur obligatoires.', 'error');
      return;
    }

    if (editingPartner) {
      // Modification
      const updated = financialPartners.map((p) => {
        if (p.id === editingPartner.id) {
          return {
            ...p,
            name: partnerForm.name.trim(),
            phone: partnerForm.phone.trim(),
            email: partnerForm.email.trim(),
            capitalInvested: Number(partnerForm.capital) || 0,
            profitSharePercent: Number(partnerForm.share) || 0,
            paymentMethod: partnerForm.method,
            accountDetails: partnerForm.account.trim(),
            status: partnerForm.status,
            notes: partnerForm.notes.trim(),
            unpaidArrears: Number(partnerForm.arrears) || 0,
          };
        }
        return p;
      });
      saveFinancialPartners(updated);
      addToast(`Partenaire ${partnerForm.name} modifié avec succès.`, 'success');
    } else {
      // Création
      const newPartner: FinancialPartner = {
        id: `fp-${Date.now()}`,
        name: partnerForm.name.trim(),
        phone: partnerForm.phone.trim(),
        email: partnerForm.email.trim(),
        capitalInvested: Number(partnerForm.capital) || 0,
        profitSharePercent: Number(partnerForm.share) || 0,
        paymentMethod: partnerForm.method,
        accountDetails: partnerForm.account.trim(),
        startDate: new Date().toISOString().split('T')[0],
        status: partnerForm.status,
        notes: partnerForm.notes.trim(),
        isCurrentMonthPaid: false,
        unpaidArrears: Number(partnerForm.arrears) || 0,
      };
      saveFinancialPartners([...financialPartners, newPartner]);
      addToast(`Nouvel investisseur ${newPartner.name} enregistré.`, 'success');
    }

    setShowAddPartnerModal(false);
  };

  // Ouvrir modal d'ajout produit dépôt
  const handleOpenAddProduct = () => {
    setEditingProduct(null);
    setProductForm({
      productName: '',
      category: 'High-Tech',
      sku: '',
      partnerName: '',
      partnerPhone: '',
      partnerEmail: '',
      qtyDeposited: 5,
      unitPrice: 250000,
      commissionPercent: 12,
    });
    setShowAddConsignmentModal(true);
  };

  // Ouvrir modal d'édition produit dépôt
  const handleOpenEditProduct = (prod: ConsignmentProduct) => {
    setEditingProduct(prod);
    setProductForm({
      productName: prod.productName,
      category: prod.category,
      sku: prod.sku,
      partnerName: prod.partnerName,
      partnerPhone: prod.partnerPhone,
      partnerEmail: prod.partnerEmail,
      qtyDeposited: prod.qtyDeposited,
      unitPrice: prod.unitSellingPrice,
      commissionPercent: prod.shopCommissionPercent,
    });
    setShowAddConsignmentModal(true);
  };

  // Enregistrer produit en dépôt (Ajout ou Modification)
  const handleSaveProductSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!productForm.productName.trim() || !productForm.partnerName.trim()) {
      addToast('Nom de l’article et propriétaire requis.', 'error');
      return;
    }

    if (editingProduct) {
      // Modification
      const updated = consignmentProducts.map((p) => {
        if (p.id === editingProduct.id) {
          return {
            ...p,
            productName: productForm.productName.trim(),
            category: productForm.category.trim(),
            partnerName: productForm.partnerName.trim(),
            partnerPhone: productForm.partnerPhone.trim(),
            partnerEmail: productForm.partnerEmail.trim(),
            qtyDeposited: Number(productForm.qtyDeposited) || p.qtyDeposited,
            unitSellingPrice: Number(productForm.unitPrice) || p.unitSellingPrice,
            shopCommissionPercent: Number(productForm.commissionPercent) || p.shopCommissionPercent,
          };
        }
        return p;
      });
      saveConsignmentProducts(updated);
      addToast(`Article en consignation "${productForm.productName}" mis à jour.`, 'success');
    } else {
      // Création
      const generatedSku = productForm.sku.trim() || `DEP-${Date.now().toString().slice(-6)}`;
      const newProd: ConsignmentProduct = {
        id: `cp-${Date.now()}`,
        productName: productForm.productName.trim(),
        category: productForm.category.trim(),
        sku: generatedSku,
        partnerId: `p-${Date.now()}`,
        partnerName: productForm.partnerName.trim(),
        partnerPhone: productForm.partnerPhone.trim(),
        partnerEmail: productForm.partnerEmail.trim(),
        qtyDeposited: Number(productForm.qtyDeposited) || 1,
        qtySold: 0,
        qtyPaid: 0,
        unitSellingPrice: Number(productForm.unitPrice) || 0,
        shopCommissionPercent: Number(productForm.commissionPercent) || 12,
        depositDate: new Date().toISOString().split('T')[0],
        status: 'IN_STOCK',
      };
      saveConsignmentProducts([...consignmentProducts, newProd]);
      addToast(`Produit "${newProd.productName}" enregistré en dépôt-vente.`, 'success');
    }

    setShowAddConsignmentModal(false);
  };

  // Suppression
  const handleConfirmDelete = () => {
    if (!deletingConfirmTarget) return;

    if (deletingConfirmTarget.type === 'PARTNER') {
      const filtered = financialPartners.filter((p) => p.id !== deletingConfirmTarget.id);
      saveFinancialPartners(filtered);
      addToast(`Partenaire ${deletingConfirmTarget.name} supprimé avec succès.`, 'success');
    } else {
      const filtered = consignmentProducts.filter((p) => p.id !== deletingConfirmTarget.id);
      saveConsignmentProducts(filtered);
      addToast(`Produit "${deletingConfirmTarget.name}" supprimé.`, 'success');
    }

    setDeletingConfirmTarget(null);
  };

  // Ouverture du modal de règlement / décaissement
  const handleOpenFinancialPayout = (partner: FinancialPartner) => {
    const currentMonthVal = partner.isCurrentMonthPaid
      ? 0
      : Math.round((netRealProfit * partner.profitSharePercent) / 100);
    const arrearsVal = partner.unpaidArrears || 0;
    const totalVal = currentMonthVal + arrearsVal;

    setPayoutTarget({
      id: partner.id,
      name: partner.name,
      type: 'FINANCIAL',
      currentMonthAmount: currentMonthVal,
      arrearsAmount: arrearsVal,
      totalAmount: totalVal,
    });

    setSelectedPayoutMode(arrearsVal > 0 && currentMonthVal > 0 ? 'ALL' : arrearsVal > 0 ? 'ARREARS_ONLY' : 'CURRENT_MONTH');
    setPayoutPeriod(`Dividendes ${currentMonthLabel}`);
    setPayoutRef(`VIR-${Date.now().toString().slice(-6)}`);
    setShowPayoutModal(true);
  };

  const handleOpenConsignmentPayout = (prod: ConsignmentProduct) => {
    const unpaidQty = Math.max(0, prod.qtySold - prod.qtyPaid);
    const dueAmount = unpaidQty * prod.unitSellingPrice * (1 - prod.shopCommissionPercent / 100);

    setPayoutTarget({
      id: prod.partnerId,
      name: prod.partnerName,
      type: 'CONSIGNMENT',
      currentMonthAmount: dueAmount,
      arrearsAmount: 0,
      totalAmount: dueAmount,
      productId: prod.id,
    });

    setSelectedPayoutMode('ALL');
    setPayoutPeriod(`Reversement Ventes : ${prod.productName} (${unpaidQty} unités)`);
    setPayoutRef(`REG-DEPOT-${Date.now().toString().slice(-6)}`);
    setShowPayoutModal(true);
  };

  // Validation du paiement : Réinitialisation du solde et enregistrement
  const handleConfirmPayoutSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!payoutTarget) return;

    let payAmount = 0;
    if (payoutTarget.type === 'FINANCIAL') {
      if (selectedPayoutMode === 'CURRENT_MONTH') {
        payAmount = payoutTarget.currentMonthAmount;
      } else if (selectedPayoutMode === 'ARREARS_ONLY') {
        payAmount = payoutTarget.arrearsAmount;
      } else {
        payAmount = payoutTarget.totalAmount;
      }
    } else {
      payAmount = payoutTarget.totalAmount;
    }

    if (payAmount <= 0) {
      addToast('Aucun montant à reverser.', 'error');
      return;
    }

    const receiptNum = `QUITT-${new Date().getFullYear()}-${Date.now().toString().slice(-5)}`;

    // 1. Enregistrement dans le journal des quittances
    const newPayout: PartnerPayout = {
      id: `pay-${Date.now()}`,
      partnerId: payoutTarget.id,
      partnerName: payoutTarget.name,
      partnerType: payoutTarget.type,
      amount: payAmount,
      payoutDate: new Date().toISOString().split('T')[0],
      periodLabel: payoutPeriod,
      paymentMethod: payoutMethod,
      reference: payoutRef,
      status: 'PAID',
      receiptNumber: receiptNum,
      notes: payoutTarget.type === 'FINANCIAL' ? `Mode sélectionné : ${selectedPayoutMode}` : 'Soldé lot consignation',
    };

    savePayouts([newPayout, ...payouts]);

    // 2. Réinitialisation intelligente du compteur pour éviter toute confusion
    if (payoutTarget.type === 'FINANCIAL') {
      const updated = financialPartners.map((p) => {
        if (p.id === payoutTarget.id) {
          let updatedArrears = p.unpaidArrears || 0;
          let isMonthPaid = p.isCurrentMonthPaid || false;

          if (selectedPayoutMode === 'ALL') {
            updatedArrears = 0;
            isMonthPaid = true;
          } else if (selectedPayoutMode === 'ARREARS_ONLY') {
            updatedArrears = 0;
          } else if (selectedPayoutMode === 'CURRENT_MONTH') {
            isMonthPaid = true;
          }

          return {
            ...p,
            unpaidArrears: updatedArrears,
            isCurrentMonthPaid: isMonthPaid,
          };
        }
        return p;
      });
      saveFinancialPartners(updated);
    } else if (payoutTarget.type === 'CONSIGNMENT' && payoutTarget.productId) {
      // Pour les produits : la quantité payée rattrape la quantité vendue, le montant dû repasse à 0 !
      const updatedProds = consignmentProducts.map((prod) => {
        if (prod.id === payoutTarget.productId) {
          return {
            ...prod,
            qtyPaid: prod.qtySold, // Tout ce qui a été vendu à ce jour est payé !
          };
        }
        return prod;
      });
      saveConsignmentProducts(updatedProds);
    }

    setShowPayoutModal(false);
    addToast(`Paiement de ${formatMoney(payAmount)} validé pour ${payoutTarget.name}. Reçu officiel : ${receiptNum}`, 'success');
  };

  // Clôture mensuelle & bascule en arriérés pour les partenaires non payés
  const handleCloseMonthRollOver = () => {
    let unpaidPartnersCount = 0;
    const updated = financialPartners.map((p) => {
      if (p.status === 'ACTIVE' && !p.isCurrentMonthPaid) {
        const monthDue = Math.round((netRealProfit * p.profitSharePercent) / 100);
        unpaidPartnersCount++;
        return {
          ...p,
          unpaidArrears: (p.unpaidArrears || 0) + monthDue, // Bascule en arriéré séparé
          isCurrentMonthPaid: false, // Prêt pour le nouveau mois
        };
      }
      return {
        ...p,
        isCurrentMonthPaid: false, // Nouveau mois démarré
      };
    });

    saveFinancialPartners(updated);
    addToast(`Clôture mensuelle effectuée : ${unpaidPartnersCount} partenaire(s) non payé(s) basculé(s) en crédit arriérés. Nouveau mois démarré !`, 'success');
  };

  return (
    <div style={{ padding: '1.5rem', maxWidth: '1440px', margin: '0 auto' }}>
      <PageHeader
        title="Partenaires, Investisseurs & Dépôt-Vente"
        subtitle="Gestion transparente des cycles mensuels de bénéfices, suivi des arriérés, verrous d'échéance et traçabilité des dépôts-ventes."
        secondaryActions={
          <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap', alignItems: 'center' }}>
            {/* Interrupteur Déverrouillage Anticipé pour l'Admin */}
            <label
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.45rem',
                fontSize: '0.78rem',
                fontWeight: 700,
                background: forceUnlock ? '#fef3c7' : '#f1f5f9',
                color: forceUnlock ? '#92400e' : '#475569',
                padding: '0.45rem 0.75rem',
                borderRadius: '8px',
                cursor: 'pointer',
                border: '1px solid var(--border)',
              }}
              title="Permet de déverrouiller immédiatement les paiements sans attendre le 25 du mois"
            >
              <input
                type="checkbox"
                checked={forceUnlock}
                onChange={(e) => setForceUnlock(e.target.checked)}
                style={{ cursor: 'pointer' }}
              />
              <span>{forceUnlock ? '🔓 Échéance forcée (Active)' : '🔒 Cycle Fin de Mois (Dès le 25)'}</span>
            </label>

            <button
              type="button"
              className="primary"
              onClick={handleOpenAddPartner}
              style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.65rem 1.1rem', fontWeight: 700 }}
            >
              <span>💼</span> + Nouvel Investisseur
            </button>
            <button
              type="button"
              className="secondary"
              onClick={handleOpenAddProduct}
              style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.65rem 1.1rem', fontWeight: 700 }}
            >
              <span>📦</span> + Dépôt-Vente (Produit Tiers)
            </button>
          </div>
        }
      />

      {/* Top Quick KPIs Cards */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))',
          gap: '1rem',
          margin: '1.5rem 0',
        }}
      >
        <div style={{ background: 'var(--surface)', padding: '1.25rem', borderRadius: '12px', border: '1px solid var(--border)', boxShadow: 'var(--shadow-sm)' }}>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>
            Capital Investi (Total)
          </div>
          <div style={{ fontSize: '1.45rem', fontWeight: 800, color: '#1e40af', marginTop: '0.35rem' }}>
            {formatMoney(totalCapitalInvested)}
          </div>
          <div style={{ fontSize: '0.78rem', color: '#059669', marginTop: '0.3rem', fontWeight: 600 }}>
            👥 {financialPartners.length} partenaires • Part Magasin : {shopRetainedPercent}%
          </div>
        </div>

        <div style={{ background: 'var(--surface)', padding: '1.25rem', borderRadius: '12px', border: '1px solid var(--border)', boxShadow: 'var(--shadow-sm)' }}>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>
            Bénéfice Net Réel ({currentMonthLabel})
          </div>
          <div style={{ fontSize: '1.45rem', fontWeight: 800, color: '#047857', marginTop: '0.35rem' }}>
            {formatMoney(netRealProfit)}
          </div>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '0.3rem' }}>
            Jour {currentDay}/{daysInMonth} • Cumul estimé : {formatMoney(dailyEstimatedProfit)}
          </div>
        </div>

        <div style={{ background: 'var(--surface)', padding: '1.25rem', borderRadius: '12px', border: '1px solid var(--border)', boxShadow: 'var(--shadow-sm)' }}>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>
            Dividendes Partenaires ({totalPartnerSharePercent}%)
          </div>
          <div style={{ fontSize: '1.45rem', fontWeight: 800, color: '#b45309', marginTop: '0.35rem' }}>
            {formatMoney(totalPartnersPayout)}
          </div>
          <div style={{ fontSize: '0.78rem', color: '#b45309', marginTop: '0.3rem', fontWeight: 600 }}>
            {totalArrearsDue > 0 ? `⚠️ Dont Arriérés impayés : ${formatMoney(totalArrearsDue)}` : '✓ Aucun arriéré en retard'}
          </div>
        </div>

        <div style={{ background: 'var(--surface)', padding: '1.25rem', borderRadius: '12px', border: '1px solid var(--border)', boxShadow: 'var(--shadow-sm)' }}>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>
            En Attente Reversement Dépôt
          </div>
          <div style={{ fontSize: '1.45rem', fontWeight: 800, color: '#7c3aed', marginTop: '0.35rem' }}>
            {formatMoney(consignmentStats.totalDueToPartners)}
          </div>
          <div style={{ fontSize: '0.78rem', color: '#6d28d9', marginTop: '0.3rem', fontWeight: 600 }}>
            Déjà soldé aux déposants : {formatMoney(consignmentStats.totalAlreadyPaidToPartners)}
          </div>
        </div>
      </div>

      {/* Tabs Bar */}
      <div
        style={{
          display: 'flex',
          gap: '0.5rem',
          borderBottom: '2px solid var(--border)',
          marginBottom: '1.5rem',
          overflowX: 'auto',
        }}
      >
        {[
          { key: 'simulation', label: '🧮 Synthèse & Calculateur de Bénéfice Réel', badge: 'Déduction charges' },
          { key: 'financial', label: '💼 Partenaires Financiers (Capital, % & Arriérés)', badge: `${financialPartners.length} Investisseurs` },
          { key: 'consignment', label: '📦 Partenaires Produits (Dépôt-Vente & Soldes)', badge: `${consignmentProducts.length} Articles` },
          { key: 'payouts', label: '📑 Journal des Quittances & Règlements', badge: `${payouts.length} Décaissements` },
        ].map((tab) => {
          const isActive = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key as any)}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'flex-start',
                padding: '0.7rem 1.25rem',
                border: 'none',
                background: isActive ? 'var(--surface)' : 'transparent',
                borderBottom: isActive ? '3px solid #2563eb' : '3px solid transparent',
                cursor: 'pointer',
                borderRadius: '8px 8px 0 0',
                transition: 'all 0.15s ease',
              }}
            >
              <span style={{ fontWeight: isActive ? 700 : 600, fontSize: '0.92rem', color: isActive ? '#1e40af' : 'var(--text)' }}>
                {tab.label}
              </span>
              <span style={{ fontSize: '0.74rem', color: isActive ? '#2563eb' : 'var(--text-muted)' }}>
                {tab.badge}
              </span>
            </button>
          );
        })}
      </div>

      {/* ══════════════════════════════════════════════════════════════
          ONGLET 1 : CALCULATEUR DE BÉNÉFICE RÉEL & RÉPARTITION
         ══════════════════════════════════════════════════════════════ */}
      {activeTab === 'simulation' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '1.5rem' }}>
          {/* Charges déductibles */}
          <div
            style={{
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius)',
              padding: '1.5rem',
              boxShadow: 'var(--shadow-sm)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                <span style={{ fontSize: '1.3rem' }}>⚖️</span>
                <h3 style={{ margin: 0, fontSize: '1.15rem' }}>Charges & Déductions Réelles de la Boutique</h3>
              </div>
              <span style={{ fontSize: '0.75rem', background: '#e0f2fe', color: '#0369a1', padding: '0.2rem 0.6rem', borderRadius: '6px', fontWeight: 700 }}>
                {currentMonthLabel}
              </span>
            </div>
            <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', margin: '0 0 1.25rem' }}>
              Le pourcentage des partenaires financiers est calculé rigoureusement sur le <strong>bénéfice net réel</strong>,
              après déduction intégrale des salaires, loyer, factures d'énergie et frais généraux.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.84rem', fontWeight: 700, marginBottom: '0.25rem' }}>
                  <span>📈 Chiffre d'Affaires Brut (CA) du mois</span>
                  {isRevenueAutoDetected ? (
                    <span style={{ fontSize: '0.72rem', background: '#dcfce7', color: '#166534', padding: '2px 8px', borderRadius: '4px', fontWeight: 700 }}>
                      ✓ Détecté automatiquement depuis les ventes du mois
                    </span>
                  ) : (
                    <span style={{ fontSize: '0.72rem', background: '#f1f5f9', color: '#475569', padding: '2px 8px', borderRadius: '4px' }}>
                      Synchronisé avec les ventes
                    </span>
                  )}
                </label>
                <input
                  type="number"
                  value={revenue}
                  onChange={(e) => setRevenue(Number(e.target.value) || 0)}
                  style={{ width: '100%', padding: '0.6rem', borderRadius: '6px', border: '1px solid var(--border)', fontSize: '0.95rem', fontWeight: 700 }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.84rem', fontWeight: 700, marginBottom: '0.25rem', color: '#b91c1c' }}>
                  📉 Coût d'achat des marchandises vendues (COGS)
                </label>
                <input
                  type="number"
                  value={cogs}
                  onChange={(e) => setCogs(Number(e.target.value) || 0)}
                  style={{ width: '100%', padding: '0.6rem', borderRadius: '6px', border: '1px solid var(--border)', fontSize: '0.95rem' }}
                />
              </div>

              <div style={{ background: '#f8fafc', padding: '0.85rem', borderRadius: '6px', border: '1px dashed #cbd5e1' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.88rem', fontWeight: 700, color: '#0f172a' }}>
                  <span>= Marge Brute Commerciale :</span>
                  <span style={{ color: '#2563eb' }}>{formatMoney(grossMargin)}</span>
                </div>
              </div>

              <div style={{ borderTop: '1px solid var(--border)', paddingTop: '1rem' }}>
                <div style={{ fontWeight: 700, fontSize: '0.88rem', marginBottom: '0.75rem', color: '#b91c1c' }}>
                  Dépenses d'Exploitation Réelles Soustraites :
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.2rem' }}>
                      👥 Salaires du Personnel
                    </label>
                    <input
                      type="number"
                      value={salaryExpense}
                      onChange={(e) => setSalaryExpense(Number(e.target.value) || 0)}
                      style={{ width: '100%', padding: '0.5rem', borderRadius: '6px', border: '1px solid var(--border)' }}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.2rem' }}>
                      🏢 Loyer Commercial
                    </label>
                    <input
                      type="number"
                      value={rentExpense}
                      onChange={(e) => setRentExpense(Number(e.target.value) || 0)}
                      style={{ width: '100%', padding: '0.5rem', borderRadius: '6px', border: '1px solid var(--border)' }}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.2rem' }}>
                      ⚡ Électricité, Eau & Web
                    </label>
                    <input
                      type="number"
                      value={electricityExpense}
                      onChange={(e) => setElectricityExpense(Number(e.target.value) || 0)}
                      style={{ width: '100%', padding: '0.5rem', borderRadius: '6px', border: '1px solid var(--border)' }}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.2rem' }}>
                      🔧 Dépenses Diverses & Frais
                    </label>
                    <input
                      type="number"
                      value={miscExpense}
                      onChange={(e) => setMiscExpense(Number(e.target.value) || 0)}
                      style={{ width: '100%', padding: '0.5rem', borderRadius: '6px', border: '1px solid var(--border)' }}
                    />
                  </div>
                </div>
              </div>

              <div
                style={{
                  background: '#f0fdf4',
                  border: '1px solid #bbf7d0',
                  borderRadius: '8px',
                  padding: '1rem',
                  marginTop: '0.5rem',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontSize: '0.78rem', textTransform: 'uppercase', color: '#166534', fontWeight: 700 }}>
                      Bénéfice Net Réel Distribuable du Mois
                    </div>
                    <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#14532d', marginTop: '0.2rem' }}>
                      {formatMoney(netRealProfit)}
                    </div>
                  </div>
                  <span style={{ fontSize: '1.8rem' }}>💰</span>
                </div>
              </div>
            </div>
          </div>

          {/* Ventilation automatique entre investisseurs & Réserve Magasin */}
          <div
            style={{
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius)',
              padding: '1.5rem',
              boxShadow: 'var(--shadow-sm)',
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                <span style={{ fontSize: '1.3rem' }}>📊</span>
                <h3 style={{ margin: 0, fontSize: '1.15rem' }}>Quote-parts & Solde au Jour le Jour</h3>
              </div>
              <span style={{ fontSize: '0.82rem', background: '#e0f2fe', color: '#0369a1', padding: '0.25rem 0.65rem', borderRadius: '999px', fontWeight: 700 }}>
                {totalPartnerSharePercent}% attribué aux tiers
              </span>
            </div>

            <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', margin: '0 0 1.25rem' }}>
              Solde calculé automatiquement en temps réel (Jour {currentDay} sur {daysInMonth} de {currentMonthLabel}).
              Le bouton de paiement est activable dès l'échéance de fin de mois.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', flex: 1 }}>
              {financialPartners.map((partner) => {
                const currentMonthShare = Math.round((netRealProfit * partner.profitSharePercent) / 100);
                const dailyCalculated = Math.round((dailyEstimatedProfit * partner.profitSharePercent) / 100);
                const arrears = partner.unpaidArrears || 0;
                const totalDue = (partner.isCurrentMonthPaid ? 0 : currentMonthShare) + arrears;

                return (
                  <div
                    key={partner.id}
                    style={{
                      border: '1px solid var(--border)',
                      borderRadius: '8px',
                      padding: '1rem',
                      background: partner.isCurrentMonthPaid ? '#f0fdf4' : '#f8fafc',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: '1rem',
                    }}
                  >
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <span style={{ fontWeight: 700, fontSize: '0.92rem', color: '#0f172a' }}>
                          {partner.name}
                        </span>
                        {partner.isCurrentMonthPaid && (
                          <span style={{ background: '#dcfce7', color: '#15803d', fontSize: '0.72rem', fontWeight: 700, padding: '2px 6px', borderRadius: '4px' }}>
                            ✓ Mois Réglé
                          </span>
                        )}
                        {arrears > 0 && (
                          <span style={{ background: '#fee2e2', color: '#991b1b', fontSize: '0.72rem', fontWeight: 800, padding: '2px 6px', borderRadius: '4px' }}>
                            ⚠️ Arriérés : {formatMoney(arrears)}
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize: '0.78rem', color: '#64748b', marginTop: '0.2rem' }}>
                        Apport : <strong>{formatMoney(partner.capitalInvested)}</strong> • Part : <strong>{partner.profitSharePercent}%</strong>
                        {' • '}Solde estimé à ce jour (J{currentDay}) : <strong>{formatMoney(dailyCalculated)}</strong>
                      </div>
                      <div style={{ fontSize: '0.74rem', color: '#0369a1', marginTop: '0.2rem' }}>
                        Mode : {partner.accountDetails}
                      </div>
                    </div>

                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: '1.15rem', fontWeight: 800, color: totalDue > 0 ? '#047857' : '#64748b' }}>
                        {formatMoney(totalDue)}
                      </div>
                      {totalDue > 0 ? (
                        <button
                          type="button"
                          onClick={() => handleOpenFinancialPayout(partner)}
                          disabled={!isEndOfMonthPayable}
                          className="primary"
                          style={{
                            fontSize: '0.75rem',
                            padding: '0.35rem 0.75rem',
                            marginTop: '0.35rem',
                            borderRadius: '4px',
                            background: isEndOfMonthPayable ? '#2563eb' : '#94a3b8',
                            cursor: isEndOfMonthPayable ? 'pointer' : 'not-allowed',
                          }}
                          title={!isEndOfMonthPayable ? 'Verrouillé jusqu’au 25 du mois (Activez le déverrouillage forcé en haut à droite si nécessaire)' : 'Procéder au décaissement'}
                        >
                          {isEndOfMonthPayable ? '💳 Payer (Fin de mois)' : '🔒 Fin de mois'}
                        </button>
                      ) : (
                        <span style={{ fontSize: '0.74rem', color: '#16a34a', fontWeight: 700 }}>
                          Solde à jour
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}

              {/* Reste pour la boutique */}
              <div
                style={{
                  marginTop: 'auto',
                  border: '2px dashed #3b82f6',
                  borderRadius: '8px',
                  padding: '1rem',
                  background: '#eff6ff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                <div>
                  <div style={{ fontWeight: 800, fontSize: '0.95rem', color: '#1e40af' }}>
                    🏢 Part Entreprise & Trésorerie Magasin
                  </div>
                  <div style={{ fontSize: '0.78rem', color: '#3b82f6' }}>
                    Pourcentage conservé pour la boutique : <strong>{shopRetainedPercent}%</strong>
                  </div>
                </div>
                <div style={{ fontSize: '1.3rem', fontWeight: 800, color: '#1e40af' }}>
                  {formatMoney(shopRetainedProfit)}
                </div>
              </div>

              {/* Bouton Clôture Mensuelle / Report Arriérés */}
              <div style={{ marginTop: '0.75rem', display: 'flex', justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  className="secondary"
                  onClick={handleCloseMonthRollOver}
                  style={{ fontSize: '0.8rem', padding: '0.5rem 1rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}
                  title="Effectue le passage au mois suivant : tout dividende non payé est basculé en arriéré distinct sans mélanger"
                >
                  <span>🔄</span> Clôturer le mois & Reporter les impayés en arriérés
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════
          ONGLET 2 : PARTENAIRES FINANCIERS (CRUD & ARRIÉRÉS)
         ══════════════════════════════════════════════════════════════ */}
      {activeTab === 'financial' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
            <div>
              <h3 style={{ margin: 0, fontSize: '1.15rem' }}>Portefeuille des Partenaires Financiers (Investisseurs)</h3>
              <p style={{ margin: '0.2rem 0 0', fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                Gestion complète (Créer, Modifier, Supprimer), verrous d'échéance de fin de mois et suivi rigoureux des arriérés.
              </p>
            </div>
            <button
              type="button"
              className="primary"
              onClick={handleOpenAddPartner}
              style={{ padding: '0.6rem 1.2rem', fontWeight: 700 }}
            >
              + Nouvel Investisseur
            </button>
          </div>

          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '12px', overflow: 'hidden', boxShadow: 'var(--shadow-sm)' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.88rem' }}>
              <thead>
                <tr style={{ background: '#f8fafc', borderBottom: '1px solid var(--border)', textAlign: 'left' }}>
                  <th style={{ padding: '0.85rem 1rem', fontWeight: 700 }}>Investisseur & Contact</th>
                  <th style={{ padding: '0.85rem 1rem', fontWeight: 700 }}>Capital Investi</th>
                  <th style={{ padding: '0.85rem 1rem', fontWeight: 700 }}>Part Bénéfice (%)</th>
                  <th style={{ padding: '0.85rem 1rem', fontWeight: 700 }}>Arriérés Antérieurs</th>
                  <th style={{ padding: '0.85rem 1rem', fontWeight: 700 }}>Dividende Mois Actuel</th>
                  <th style={{ padding: '0.85rem 1rem', fontWeight: 700 }}>Total Net Dû</th>
                  <th style={{ padding: '0.85rem 1rem', fontWeight: 700, textAlign: 'right' }}>Actions & Gestion</th>
                </tr>
              </thead>
              <tbody>
                {financialPartners.map((partner) => {
                  const currentMonthVal = partner.isCurrentMonthPaid
                    ? 0
                    : Math.round((netRealProfit * partner.profitSharePercent) / 100);
                  const arrearsVal = partner.unpaidArrears || 0;
                  const totalDue = currentMonthVal + arrearsVal;

                  return (
                    <tr key={partner.id} style={{ borderBottom: '1px solid var(--border)' }}>
                      <td style={{ padding: '1rem' }}>
                        <div style={{ fontWeight: 700, color: 'var(--text)' }}>{partner.name}</div>
                        <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                          📞 {partner.phone} {partner.email ? `• ✉️ ${partner.email}` : ''}
                        </div>
                        <div style={{ fontSize: '0.74rem', color: '#0369a1', marginTop: '0.2rem' }}>
                          Mode : {partner.accountDetails}
                        </div>
                      </td>
                      <td style={{ padding: '1rem', fontWeight: 700, color: '#1e40af' }}>
                        {formatMoney(partner.capitalInvested)}
                      </td>
                      <td style={{ padding: '1rem' }}>
                        <span style={{ background: '#e0e7ff', color: '#3730a3', padding: '0.25rem 0.6rem', borderRadius: '6px', fontWeight: 800 }}>
                          {partner.profitSharePercent}%
                        </span>
                      </td>
                      <td style={{ padding: '1rem' }}>
                        {arrearsVal > 0 ? (
                          <span style={{ background: '#fee2e2', color: '#991b1b', padding: '0.25rem 0.6rem', borderRadius: '6px', fontWeight: 800, fontSize: '0.82rem' }}>
                            ⚠️ {formatMoney(arrearsVal)}
                          </span>
                        ) : (
                          <span style={{ color: '#16a34a', fontSize: '0.8rem', fontWeight: 600 }}>0 FCFA</span>
                        )}
                      </td>
                      <td style={{ padding: '1rem' }}>
                        {partner.isCurrentMonthPaid ? (
                          <span style={{ color: '#16a34a', fontWeight: 700, fontSize: '0.82rem' }}>✓ Payé ce mois</span>
                        ) : (
                          <span style={{ fontWeight: 700, color: '#047857' }}>{formatMoney(currentMonthVal)}</span>
                        )}
                      </td>
                      <td style={{ padding: '1rem', fontWeight: 800, fontSize: '1rem', color: totalDue > 0 ? '#047857' : '#64748b' }}>
                        {formatMoney(totalDue)}
                      </td>
                      <td style={{ padding: '1rem', textAlign: 'right' }}>
                        <div style={{ display: 'flex', gap: '0.4rem', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                          <button
                            type="button"
                            className="secondary"
                            onClick={() => handleOpenEditPartner(partner)}
                            style={{ fontSize: '0.78rem', padding: '0.35rem 0.65rem' }}
                            title="Modifier les coordonnées et pourcentages"
                          >
                            ✏️ Modifier
                          </button>

                          <button
                            type="button"
                            className="secondary"
                            onClick={() => setDeletingConfirmTarget({ id: partner.id, name: partner.name, type: 'PARTNER' })}
                            style={{ fontSize: '0.78rem', padding: '0.35rem 0.65rem', color: '#dc2626' }}
                            title="Supprimer ce partenaire"
                          >
                            🗑️
                          </button>

                          {totalDue > 0 && (
                            <button
                              type="button"
                              className="primary"
                              disabled={!isEndOfMonthPayable}
                              onClick={() => handleOpenFinancialPayout(partner)}
                              style={{
                                fontSize: '0.78rem',
                                padding: '0.35rem 0.75rem',
                                background: isEndOfMonthPayable ? '#2563eb' : '#94a3b8',
                                cursor: isEndOfMonthPayable ? 'pointer' : 'not-allowed',
                              }}
                              title={!isEndOfMonthPayable ? 'Paiement verrouillé jusqu’au 25 du mois' : 'Payer maintenant'}
                            >
                              {isEndOfMonthPayable ? '💳 Payer' : '🔒 Fin de mois'}
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════
          ONGLET 3 : PARTENAIRES PRODUITS (DÉPÔT-VENTE & SOLDES)
         ══════════════════════════════════════════════════════════════ */}
      {activeTab === 'consignment' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
            <div>
              <h3 style={{ margin: 0, fontSize: '1.15rem' }}>Articles en Dépôt-Vente & Consignation</h3>
              <p style={{ margin: '0.2rem 0 0', fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                Pour chaque produit : propriétaire légitime tracé, unités vendues payées vs à reverser, et réinitialisation automatique du solde après règlement.
              </p>
            </div>
            <button
              type="button"
              className="primary"
              onClick={handleOpenAddProduct}
              style={{ padding: '0.6rem 1.2rem', fontWeight: 700 }}
            >
              + Nouveau Produit Déposé
            </button>
          </div>

          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '12px', overflow: 'hidden', boxShadow: 'var(--shadow-sm)' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.88rem' }}>
              <thead>
                <tr style={{ background: '#f8fafc', borderBottom: '1px solid var(--border)', textAlign: 'left' }}>
                  <th style={{ padding: '0.85rem 1rem', fontWeight: 700 }}>Article & SKU</th>
                  <th style={{ padding: '0.85rem 1rem', fontWeight: 700 }}>Propriétaire Légal</th>
                  <th style={{ padding: '0.85rem 1rem', fontWeight: 700 }}>Stock (Déposé / Vendu / Payé)</th>
                  <th style={{ padding: '0.85rem 1rem', fontWeight: 700 }}>Prix Unitaire</th>
                  <th style={{ padding: '0.85rem 1rem', fontWeight: 700 }}>Commission Magasin</th>
                  <th style={{ padding: '0.85rem 1rem', fontWeight: 700 }}>Net Dû en Attente</th>
                  <th style={{ padding: '0.85rem 1rem', fontWeight: 700, textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {consignmentProducts.map((prod) => {
                  const stockRestant = prod.qtyDeposited - prod.qtySold;
                  const unpaidQty = Math.max(0, prod.qtySold - prod.qtyPaid);
                  const netDue = unpaidQty * prod.unitSellingPrice * (1 - prod.shopCommissionPercent / 100);

                  return (
                    <tr
                      key={prod.id}
                      style={{ borderBottom: '1px solid var(--border)', cursor: 'pointer' }}
                      onClick={() => setSelectedProductDetail(prod)}
                    >
                      <td style={{ padding: '1rem' }}>
                        <div style={{ fontWeight: 700, color: 'var(--text)' }}>{prod.productName}</div>
                        <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                          SKU : <code>{prod.sku}</code> • {prod.category}
                        </div>
                      </td>
                      <td style={{ padding: '1rem' }}>
                        <div style={{ fontWeight: 700, color: '#1e40af', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                          <span>🏷️</span> {prod.partnerName}
                        </div>
                        <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                          📞 {prod.partnerPhone}
                        </div>
                      </td>
                      <td style={{ padding: '1rem' }}>
                        <div style={{ fontWeight: 700 }}>
                          {prod.qtySold} vendus / {prod.qtyDeposited} déposés
                        </div>
                        <div style={{ fontSize: '0.76rem', color: '#64748b', marginTop: '0.15rem' }}>
                          {prod.qtyPaid > 0 && <span style={{ color: '#16a34a', fontWeight: 600 }}>({prod.qtyPaid} déjà soldés) • </span>}
                          <span style={{ color: stockRestant > 0 ? '#059669' : '#dc2626', fontWeight: 700 }}>
                            {stockRestant > 0 ? `En rayon : ${stockRestant}` : 'Tout vendu'}
                          </span>
                        </div>
                      </td>
                      <td style={{ padding: '1rem', fontWeight: 700 }}>
                        {formatMoney(prod.unitSellingPrice)}
                      </td>
                      <td style={{ padding: '1rem' }}>
                        <span style={{ background: '#fef3c7', color: '#92400e', padding: '0.2rem 0.55rem', borderRadius: '6px', fontWeight: 700, fontSize: '0.8rem' }}>
                          {prod.shopCommissionPercent}%
                        </span>
                      </td>
                      <td style={{ padding: '1rem', fontWeight: 800, color: netDue > 0 ? '#047857' : '#64748b' }}>
                        {netDue > 0 ? (
                          <div>
                            <div>{formatMoney(netDue)}</div>
                            <div style={{ fontSize: '0.72rem', color: '#b45309', fontWeight: 600 }}>({unpaidQty} vendus à reverser)</div>
                          </div>
                        ) : (
                          <span style={{ color: '#16a34a', fontSize: '0.8rem' }}>✓ Entièrement Soldé</span>
                        )}
                      </td>
                      <td style={{ padding: '1rem', textAlign: 'right' }} onClick={(e) => e.stopPropagation()}>
                        <div style={{ display: 'flex', gap: '0.35rem', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                          <button
                            type="button"
                            className="secondary"
                            onClick={() => setSelectedProductDetail(prod)}
                            style={{ fontSize: '0.78rem', padding: '0.35rem 0.65rem' }}
                          >
                            👁️ Fiche
                          </button>
                          <button
                            type="button"
                            className="secondary"
                            onClick={() => handleOpenEditProduct(prod)}
                            style={{ fontSize: '0.78rem', padding: '0.35rem 0.65rem' }}
                            title="Modifier ce produit déposé"
                          >
                            ✏️
                          </button>
                          <button
                            type="button"
                            className="secondary"
                            onClick={() => setDeletingConfirmTarget({ id: prod.id, name: prod.productName, type: 'PRODUCT' })}
                            style={{ fontSize: '0.78rem', padding: '0.35rem 0.65rem', color: '#dc2626' }}
                            title="Supprimer ce produit"
                          >
                            🗑️
                          </button>
                          {netDue > 0 && (
                            <button
                              type="button"
                              className="primary"
                              onClick={() => handleOpenConsignmentPayout(prod)}
                              style={{ fontSize: '0.78rem', padding: '0.35rem 0.75rem', fontWeight: 700 }}
                            >
                              Payer ({unpaidQty})
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════
          ONGLET 4 : HISTORIQUE DES DÉCAISSEMENTS & QUITTANCES
         ══════════════════════════════════════════════════════════════ */}
      {activeTab === 'payouts' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div>
            <h3 style={{ margin: 0, fontSize: '1.15rem' }}>Journal des Quittances & Règlements Partenaires</h3>
            <p style={{ margin: '0.2rem 0 0', fontSize: '0.82rem', color: 'var(--text-muted)' }}>
              Historique complet et traçable de tous les dividendes et reversements de consignation effectués avec références officielles.
            </p>
          </div>

          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '12px', overflow: 'hidden', boxShadow: 'var(--shadow-sm)' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.88rem' }}>
              <thead>
                <tr style={{ background: '#f8fafc', borderBottom: '1px solid var(--border)', textAlign: 'left' }}>
                  <th style={{ padding: '0.85rem 1rem', fontWeight: 700 }}>N° Reçu / Quittance</th>
                  <th style={{ padding: '0.85rem 1rem', fontWeight: 700 }}>Bénéficiaire Partenaire</th>
                  <th style={{ padding: '0.85rem 1rem', fontWeight: 700 }}>Type</th>
                  <th style={{ padding: '0.85rem 1rem', fontWeight: 700 }}>Période / Motif</th>
                  <th style={{ padding: '0.85rem 1rem', fontWeight: 700 }}>Montant Reversé</th>
                  <th style={{ padding: '0.85rem 1rem', fontWeight: 700 }}>Date & Référence</th>
                  <th style={{ padding: '0.85rem 1rem', fontWeight: 700, textAlign: 'right' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {payouts.map((pay) => (
                  <tr key={pay.id} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ padding: '1rem', fontWeight: 700, color: '#1e40af' }}>
                      🧾 {pay.receiptNumber}
                    </td>
                    <td style={{ padding: '1rem', fontWeight: 700 }}>
                      {pay.partnerName}
                    </td>
                    <td style={{ padding: '1rem' }}>
                      <span
                        style={{
                          background: pay.partnerType === 'FINANCIAL' ? '#e0f2fe' : '#fef3c7',
                          color: pay.partnerType === 'FINANCIAL' ? '#0369a1' : '#92400e',
                          padding: '0.2rem 0.55rem',
                          borderRadius: '6px',
                          fontSize: '0.78rem',
                          fontWeight: 700,
                        }}
                      >
                        {pay.partnerType === 'FINANCIAL' ? '💼 Investisseur' : '📦 Dépôt-Vente'}
                      </span>
                    </td>
                    <td style={{ padding: '1rem', color: 'var(--text-muted)' }}>
                      <div>{pay.periodLabel}</div>
                      {pay.notes && <div style={{ fontSize: '0.74rem', color: '#64748b' }}>{pay.notes}</div>}
                    </td>
                    <td style={{ padding: '1rem', fontWeight: 800, color: '#047857' }}>
                      {formatMoney(pay.amount)}
                    </td>
                    <td style={{ padding: '1rem', fontSize: '0.82rem' }}>
                      <div>{pay.payoutDate}</div>
                      <div style={{ color: 'var(--text-muted)' }}>{pay.paymentMethod} • {pay.reference}</div>
                    </td>
                    <td style={{ padding: '1rem', textAlign: 'right' }}>
                      <button
                        type="button"
                        onClick={() => window.print()}
                        className="secondary"
                        style={{ fontSize: '0.78rem', padding: '0.35rem 0.75rem' }}
                      >
                        🖨️ Imprimer Quittance
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════
          MODAL 1 : AJOUT / ÉDITION INVESTISSEUR FINANCIER
         ══════════════════════════════════════════════════════════════ */}
      {showAddPartnerModal && (
        <div className="modal-backdrop" onClick={() => setShowAddPartnerModal(false)}>
          <div className="modal-card" style={{ maxWidth: '580px' }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                <span style={{ fontSize: '1.4rem' }}>💼</span>
                <div>
                  <h3 style={{ margin: 0, fontSize: '1.15rem' }}>
                    {editingPartner ? `Modifier l'Investisseur : ${editingPartner.name}` : 'Nouvel Investisseur Financier'}
                  </h3>
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                    Configurez le capital apporté, la quote-part sur les bénéfices et les coordonnées de paiement
                  </div>
                </div>
              </div>
              <button type="button" onClick={() => setShowAddPartnerModal(false)} style={{ background: 'none', border: 'none', fontSize: '1.4rem', cursor: 'pointer' }}>
                ✕
              </button>
            </div>

            <form onSubmit={handleSavePartnerSubmit}>
              <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.84rem', fontWeight: 700, marginBottom: '0.25rem' }}>
                      Nom complet / Raison Sociale *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="Ex: El Hadj Diallo"
                      value={partnerForm.name}
                      onChange={(e) => setPartnerForm({ ...partnerForm, name: e.target.value })}
                      style={{ width: '100%', padding: '0.55rem', borderRadius: '6px', border: '1px solid var(--border)' }}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.84rem', fontWeight: 700, marginBottom: '0.25rem' }}>
                      Téléphone / WhatsApp *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="+226 70 00 00 00"
                      value={partnerForm.phone}
                      onChange={(e) => setPartnerForm({ ...partnerForm, phone: e.target.value })}
                      style={{ width: '100%', padding: '0.55rem', borderRadius: '6px', border: '1px solid var(--border)' }}
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.84rem', fontWeight: 700, marginBottom: '0.25rem' }}>
                      Email officiel (optionnel)
                    </label>
                    <input
                      type="email"
                      placeholder="investisseur@domaine.com"
                      value={partnerForm.email}
                      onChange={(e) => setPartnerForm({ ...partnerForm, email: e.target.value })}
                      style={{ width: '100%', padding: '0.55rem', borderRadius: '6px', border: '1px solid var(--border)' }}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.84rem', fontWeight: 700, marginBottom: '0.25rem' }}>
                      Statut
                    </label>
                    <select
                      value={partnerForm.status}
                      onChange={(e) => setPartnerForm({ ...partnerForm, status: e.target.value as any })}
                      style={{ width: '100%', padding: '0.55rem', borderRadius: '6px', border: '1px solid var(--border)' }}
                    >
                      <option value="ACTIVE">Actif (Perçoit les dividendes)</option>
                      <option value="PAUSED">En pause (Suspendu)</option>
                    </select>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr 1fr', gap: '0.75rem' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.84rem', fontWeight: 700, marginBottom: '0.25rem' }}>
                      Capital Investi (FCFA) *
                    </label>
                    <input
                      type="number"
                      required
                      min={0}
                      step={100000}
                      value={partnerForm.capital}
                      onChange={(e) => setPartnerForm({ ...partnerForm, capital: Number(e.target.value) || 0 })}
                      style={{ width: '100%', padding: '0.55rem', borderRadius: '6px', border: '1px solid var(--border)', fontWeight: 700 }}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.84rem', fontWeight: 700, marginBottom: '0.25rem' }}>
                      Quote-part (%) *
                    </label>
                    <input
                      type="number"
                      required
                      min={1}
                      max={100}
                      value={partnerForm.share}
                      onChange={(e) => setPartnerForm({ ...partnerForm, share: Number(e.target.value) || 0 })}
                      style={{ width: '100%', padding: '0.55rem', borderRadius: '6px', border: '1px solid var(--border)', fontWeight: 700, color: '#1e40af' }}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.84rem', fontWeight: 700, marginBottom: '0.25rem', color: '#b91c1c' }}>
                      Arriérés dus (FCFA)
                    </label>
                    <input
                      type="number"
                      min={0}
                      value={partnerForm.arrears}
                      onChange={(e) => setPartnerForm({ ...partnerForm, arrears: Number(e.target.value) || 0 })}
                      style={{ width: '100%', padding: '0.55rem', borderRadius: '6px', border: '1px solid var(--border)', color: '#b91c1c', fontWeight: 700 }}
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.5fr', gap: '1rem' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.84rem', fontWeight: 700, marginBottom: '0.25rem' }}>
                      Mode de Règlement
                    </label>
                    <select
                      value={partnerForm.method}
                      onChange={(e) => setPartnerForm({ ...partnerForm, method: e.target.value as any })}
                      style={{ width: '100%', padding: '0.55rem', borderRadius: '6px', border: '1px solid var(--border)' }}
                    >
                      <option value="BANK_TRANSFER">Virement Bancaire</option>
                      <option value="MOBILE_MONEY">Mobile Money</option>
                      <option value="CASH">Espèces au comptoir</option>
                    </select>
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.84rem', fontWeight: 700, marginBottom: '0.25rem' }}>
                      Détails compte (IBAN / N° Wave / OM...)
                    </label>
                    <input
                      type="text"
                      placeholder="Coordonnées de virement..."
                      value={partnerForm.account}
                      onChange={(e) => setPartnerForm({ ...partnerForm, account: e.target.value })}
                      style={{ width: '100%', padding: '0.55rem', borderRadius: '6px', border: '1px solid var(--border)' }}
                    />
                  </div>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.84rem', fontWeight: 700, marginBottom: '0.25rem' }}>
                    Notes & Clauses particulières
                  </label>
                  <textarea
                    rows={2}
                    placeholder="Objectif de l'investissement, conditions de sortie..."
                    value={partnerForm.notes}
                    onChange={(e) => setPartnerForm({ ...partnerForm, notes: e.target.value })}
                    style={{ width: '100%', padding: '0.55rem', borderRadius: '6px', border: '1px solid var(--border)' }}
                  />
                </div>
              </div>

              <div className="modal-footer" style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.6rem' }}>
                <button type="button" className="secondary" onClick={() => setShowAddPartnerModal(false)}>
                  Annuler
                </button>
                <button type="submit" className="primary" style={{ padding: '0.65rem 1.4rem', fontWeight: 700 }}>
                  {editingPartner ? 'Enregistrer les Modifications' : 'Enregistrer l’Investisseur'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════
          MODAL 2 : AJOUT / ÉDITION PRODUIT EN CONSIGNATION
         ══════════════════════════════════════════════════════════════ */}
      {showAddConsignmentModal && (
        <div className="modal-backdrop" onClick={() => setShowAddConsignmentModal(false)}>
          <div className="modal-card" style={{ maxWidth: '620px' }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                <span style={{ fontSize: '1.4rem' }}>📦</span>
                <div>
                  <h3 style={{ margin: 0, fontSize: '1.15rem' }}>
                    {editingProduct ? `Modifier le Produit : ${editingProduct.productName}` : 'Nouveau Dépôt de Marchandises (Consignation)'}
                  </h3>
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                    Rattachez l'article confié à son propriétaire légitime et configurez la commission du magasin
                  </div>
                </div>
              </div>
              <button type="button" onClick={() => setShowAddConsignmentModal(false)} style={{ background: 'none', border: 'none', fontSize: '1.4rem', cursor: 'pointer' }}>
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveProductSubmit}>
              <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div style={{ background: '#f8fafc', padding: '0.85rem', borderRadius: '8px', border: '1px solid #cbd5e1' }}>
                  <div style={{ fontWeight: 700, fontSize: '0.86rem', color: '#1e40af', marginBottom: '0.5rem' }}>
                    1. Coordonnées du Propriétaire du Produit
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '0.75rem' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.2rem' }}>
                        Nom du Propriétaire / Déposant *
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="Ex: Ibrahim Traoré (Importateur)"
                        value={productForm.partnerName}
                        onChange={(e) => setProductForm({ ...productForm, partnerName: e.target.value })}
                        style={{ width: '100%', padding: '0.5rem', borderRadius: '6px', border: '1px solid var(--border)' }}
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.2rem' }}>
                        Téléphone / WhatsApp *
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="+226 78 00 00 00"
                        value={productForm.partnerPhone}
                        onChange={(e) => setProductForm({ ...productForm, partnerPhone: e.target.value })}
                        style={{ width: '100%', padding: '0.5rem', borderRadius: '6px', border: '1px solid var(--border)' }}
                      />
                    </div>
                  </div>
                </div>

                <div style={{ fontWeight: 700, fontSize: '0.86rem', color: '#0f172a' }}>
                  2. Détails de l'Article Confié
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: '0.75rem' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.2rem' }}>
                      Désignation de l'Article *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="Ex: Samsung Galaxy S24 Ultra 512GB"
                      value={productForm.productName}
                      onChange={(e) => setProductForm({ ...productForm, productName: e.target.value })}
                      style={{ width: '100%', padding: '0.5rem', borderRadius: '6px', border: '1px solid var(--border)' }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.2rem' }}>
                      Catégorie
                    </label>
                    <input
                      type="text"
                      placeholder="High-Tech..."
                      value={productForm.category}
                      onChange={(e) => setProductForm({ ...productForm, category: e.target.value })}
                      style={{ width: '100%', padding: '0.5rem', borderRadius: '6px', border: '1px solid var(--border)' }}
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.75rem' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.2rem' }}>
                      Quantité déposée *
                    </label>
                    <input
                      type="number"
                      required
                      min={1}
                      value={productForm.qtyDeposited}
                      onChange={(e) => setProductForm({ ...productForm, qtyDeposited: Number(e.target.value) || 1 })}
                      style={{ width: '100%', padding: '0.5rem', borderRadius: '6px', border: '1px solid var(--border)', fontWeight: 700 }}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.2rem' }}>
                      Prix Unitaire Boutique (FCFA) *
                    </label>
                    <input
                      type="number"
                      required
                      min={0}
                      step={500}
                      value={productForm.unitPrice}
                      onChange={(e) => setProductForm({ ...productForm, unitPrice: Number(e.target.value) || 0 })}
                      style={{ width: '100%', padding: '0.5rem', borderRadius: '6px', border: '1px solid var(--border)', fontWeight: 700 }}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.2rem' }}>
                      Commission Magasin (%) *
                    </label>
                    <input
                      type="number"
                      required
                      min={0}
                      max={100}
                      value={productForm.commissionPercent}
                      onChange={(e) => setProductForm({ ...productForm, commissionPercent: Number(e.target.value) || 12 })}
                      style={{ width: '100%', padding: '0.5rem', borderRadius: '6px', border: '1px solid var(--border)', fontWeight: 700, color: '#b45309' }}
                    />
                  </div>
                </div>

                {/* Calcul prévisionnel */}
                <div style={{ background: '#ecfdf5', padding: '0.75rem', borderRadius: '6px', border: '1px solid #a7f3d0', fontSize: '0.8rem', color: '#065f46' }}>
                  <div>
                    💵 Pour chaque article vendu à <strong>{formatMoney(productForm.unitPrice)}</strong> :
                  </div>
                  <div style={{ marginTop: '0.2rem' }}>
                    • Part magasin retenue ({productForm.commissionPercent}%) : <strong>{formatMoney((productForm.unitPrice * productForm.commissionPercent) / 100)}</strong>
                    <br />
                    • Part nette reversée au propriétaire ({100 - productForm.commissionPercent}%) : <strong>{formatMoney(productForm.unitPrice - (productForm.unitPrice * productForm.commissionPercent) / 100)}</strong>
                  </div>
                </div>
              </div>

              <div className="modal-footer" style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.6rem' }}>
                <button type="button" className="secondary" onClick={() => setShowAddConsignmentModal(false)}>
                  Annuler
                </button>
                <button type="submit" className="primary" style={{ padding: '0.65rem 1.4rem', fontWeight: 700 }}>
                  {editingProduct ? 'Enregistrer les Modifications' : 'Enregistrer le Produit Confié'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════
          MODAL 3 : FICHE DÉTAILLÉE DU PRODUIT & PROPRIÉTAIRE
         ══════════════════════════════════════════════════════════════ */}
      {selectedProductDetail && (
        <div className="modal-backdrop" onClick={() => setSelectedProductDetail(null)}>
          <div className="modal-card" style={{ maxWidth: '640px' }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                <span style={{ fontSize: '1.4rem' }}>🏷️</span>
                <div>
                  <h3 style={{ margin: 0, fontSize: '1.15rem' }}>{selectedProductDetail.productName}</h3>
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                    Fiche de traçabilité complète • Déposé le {selectedProductDetail.depositDate}
                  </div>
                </div>
              </div>
              <button type="button" onClick={() => setSelectedProductDetail(null)} style={{ background: 'none', border: 'none', fontSize: '1.4rem', cursor: 'pointer' }}>
                ✕
              </button>
            </div>

            <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              {/* Carte Propriétaire */}
              <div style={{ background: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: '10px', padding: '1rem' }}>
                <div style={{ fontWeight: 800, fontSize: '0.88rem', color: '#1e40af', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <span>👤</span> Propriétaire Légal du Produit (Déposant)
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', fontSize: '0.84rem' }}>
                  <div>
                    <span style={{ color: 'var(--text-muted)' }}>Nom complet :</span>
                    <div style={{ fontWeight: 700, color: 'var(--text)' }}>{selectedProductDetail.partnerName}</div>
                  </div>
                  <div>
                    <span style={{ color: 'var(--text-muted)' }}>Téléphone / WhatsApp :</span>
                    <div style={{ fontWeight: 700, color: '#059669' }}>{selectedProductDetail.partnerPhone}</div>
                  </div>
                  {selectedProductDetail.partnerEmail && (
                    <div>
                      <span style={{ color: 'var(--text-muted)' }}>Email :</span>
                      <div>{selectedProductDetail.partnerEmail}</div>
                    </div>
                  )}
                  <div>
                    <span style={{ color: 'var(--text-muted)' }}>Identifiant Partenaire :</span>
                    <div><code>{selectedProductDetail.partnerId}</code></div>
                  </div>
                </div>
              </div>

              {/* État des Ventes & Répartition */}
              <div>
                <div style={{ fontWeight: 800, fontSize: '0.88rem', marginBottom: '0.5rem' }}>
                  📊 Niveaux de Stock & Soldes
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.5rem', textAlign: 'center' }}>
                  <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', padding: '0.75rem', borderRadius: '8px' }}>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Déposés</div>
                    <div style={{ fontSize: '1.2rem', fontWeight: 800 }}>{selectedProductDetail.qtyDeposited}</div>
                  </div>
                  <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', padding: '0.75rem', borderRadius: '8px' }}>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Vendus Total</div>
                    <div style={{ fontSize: '1.2rem', fontWeight: 800, color: '#047857' }}>{selectedProductDetail.qtySold}</div>
                  </div>
                  <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', padding: '0.75rem', borderRadius: '8px' }}>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Déjà Payés</div>
                    <div style={{ fontSize: '1.2rem', fontWeight: 800, color: '#2563eb' }}>{selectedProductDetail.qtyPaid}</div>
                  </div>
                  <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', padding: '0.75rem', borderRadius: '8px' }}>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>En Rayon</div>
                    <div style={{ fontSize: '1.2rem', fontWeight: 800, color: '#b45309' }}>
                      {selectedProductDetail.qtyDeposited - selectedProductDetail.qtySold}
                    </div>
                  </div>
                </div>
              </div>

              {/* Récapitulatif financier */}
              <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '8px', padding: '1rem' }}>
                {(() => {
                  const unpaidQty = Math.max(0, selectedProductDetail.qtySold - selectedProductDetail.qtyPaid);
                  const totalVenduUnpaid = unpaidQty * selectedProductDetail.unitSellingPrice;
                  const comm = (totalVenduUnpaid * selectedProductDetail.shopCommissionPercent) / 100;
                  const due = totalVenduUnpaid - comm;
                  return (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', fontSize: '0.86rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span>Prix unitaire boutique :</span>
                        <strong>{formatMoney(selectedProductDetail.unitSellingPrice)}</strong>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span>Unités vendues en attente de versement :</span>
                        <strong>{unpaidQty} unité(s)</strong>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', color: '#92400e' }}>
                        <span>Commission magasin ({selectedProductDetail.shopCommissionPercent}%) :</span>
                        <strong>- {formatMoney(comm)}</strong>
                      </div>
                      <div style={{ borderTop: '1px dashed #86efac', paddingTop: '0.4rem', display: 'flex', justifyContent: 'space-between', fontSize: '1.05rem', fontWeight: 800, color: '#14532d' }}>
                        <span>Montant Net à Reverser Immédiatement :</span>
                        <span>{formatMoney(due)}</span>
                      </div>
                    </div>
                  );
                })()}
              </div>
            </div>

            <div className="modal-footer" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <button
                type="button"
                className="secondary"
                onClick={() => {
                  window.open(`https://wa.me/${selectedProductDetail.partnerPhone.replace(/[^0-9]/g, '')}?text=Bonjour%20${encodeURIComponent(selectedProductDetail.partnerName)},%20point%20sur%20vos%20produits%20déposés%20chez%20VTM.`);
                }}
              >
                💬 Contacter sur WhatsApp
              </button>

              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button type="button" className="secondary" onClick={() => setSelectedProductDetail(null)}>
                  Fermer
                </button>
                {selectedProductDetail.qtySold > selectedProductDetail.qtyPaid && (
                  <button
                    type="button"
                    className="primary"
                    onClick={() => {
                      handleOpenConsignmentPayout(selectedProductDetail);
                      setSelectedProductDetail(null);
                    }}
                  >
                    Effectuer le Reversement
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════
          MODAL 4 : EFFECTUER UN DÉCAISSEMENT (AVEC REPORT ARRIÉRÉS)
         ══════════════════════════════════════════════════════════════ */}
      {showPayoutModal && payoutTarget && (
        <div className="modal-backdrop" onClick={() => setShowPayoutModal(false)}>
          <div className="modal-card" style={{ maxWidth: '540px' }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                <span style={{ fontSize: '1.4rem' }}>💳</span>
                <div>
                  <h3 style={{ margin: 0, fontSize: '1.15rem' }}>Règlement & Décaissement Partenaire</h3>
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                    Bénéficiaire : <strong>{payoutTarget.name}</strong>
                  </div>
                </div>
              </div>
              <button type="button" onClick={() => setShowPayoutModal(false)} style={{ background: 'none', border: 'none', fontSize: '1.4rem', cursor: 'pointer' }}>
                ✕
              </button>
            </div>

            <form onSubmit={handleConfirmPayoutSubmit}>
              <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {/* Choix du mode de paiement si arriérés existants */}
                {payoutTarget.type === 'FINANCIAL' && payoutTarget.arrearsAmount > 0 && (
                  <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '8px', padding: '0.85rem' }}>
                    <div style={{ fontSize: '0.82rem', fontWeight: 800, color: '#991b1b', marginBottom: '0.45rem' }}>
                      ⚠️ Ventilation des sommes dues :
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', fontSize: '0.84rem' }}>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                        <input
                          type="radio"
                          name="payoutMode"
                          checked={selectedPayoutMode === 'ALL'}
                          onChange={() => setSelectedPayoutMode('ALL')}
                        />
                        <span><strong>Tout solder ({formatMoney(payoutTarget.totalAmount)})</strong> — Arriérés + Mois courant</span>
                      </label>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                        <input
                          type="radio"
                          name="payoutMode"
                          checked={selectedPayoutMode === 'ARREARS_ONLY'}
                          onChange={() => setSelectedPayoutMode('ARREARS_ONLY')}
                        />
                        <span>Payer uniquement les arriérés en retard ({formatMoney(payoutTarget.arrearsAmount)})</span>
                      </label>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                        <input
                          type="radio"
                          name="payoutMode"
                          checked={selectedPayoutMode === 'CURRENT_MONTH'}
                          onChange={() => setSelectedPayoutMode('CURRENT_MONTH')}
                        />
                        <span>Payer uniquement le mois en cours ({formatMoney(payoutTarget.currentMonthAmount)})</span>
                      </label>
                    </div>
                  </div>
                )}

                <div>
                  <label style={{ display: 'block', fontSize: '0.84rem', fontWeight: 700, marginBottom: '0.25rem' }}>
                    Montant Net Reversé (FCFA) *
                  </label>
                  <div style={{ fontSize: '1.5rem', fontWeight: 900, color: '#047857', padding: '0.4rem 0' }}>
                    {formatMoney(
                      selectedPayoutMode === 'ALL'
                        ? payoutTarget.totalAmount
                        : selectedPayoutMode === 'ARREARS_ONLY'
                        ? payoutTarget.arrearsAmount
                        : payoutTarget.currentMonthAmount
                    )}
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.2rem' }}>
                      Mode de Règlement
                    </label>
                    <select
                      value={payoutMethod}
                      onChange={(e) => setPayoutMethod(e.target.value)}
                      style={{ width: '100%', padding: '0.5rem', borderRadius: '6px', border: '1px solid var(--border)' }}
                    >
                      <option value="Virement Bancaire">Virement Bancaire</option>
                      <option value="Orange Money / Wave">Orange Money / Wave</option>
                      <option value="Espèces en Caisse">Espèces en Caisse</option>
                      <option value="Chèque de Banque">Chèque de Banque</option>
                    </select>
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.2rem' }}>
                      Libellé / Titre
                    </label>
                    <input
                      type="text"
                      value={payoutPeriod}
                      onChange={(e) => setPayoutPeriod(e.target.value)}
                      style={{ width: '100%', padding: '0.5rem', borderRadius: '6px', border: '1px solid var(--border)' }}
                    />
                  </div>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.2rem' }}>
                    Référence de transaction (N° Virement, N° Reçu Wave/OM...)
                  </label>
                  <input
                    type="text"
                    value={payoutRef}
                    onChange={(e) => setPayoutRef(e.target.value)}
                    style={{ width: '100%', padding: '0.5rem', borderRadius: '6px', border: '1px solid var(--border)' }}
                  />
                </div>

                <div style={{ background: '#f8fafc', padding: '0.75rem', borderRadius: '6px', fontSize: '0.78rem', color: '#64748b' }}>
                  ℹ️ Dès validation, la somme correspondante sera <strong>réinitialisée à zéro</strong> dans le compte du partenaire et enregistrée dans le journal officiel des quittances.
                </div>
              </div>

              <div className="modal-footer" style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.6rem' }}>
                <button type="button" className="secondary" onClick={() => setShowPayoutModal(false)}>
                  Annuler
                </button>
                <button type="submit" className="primary" style={{ padding: '0.65rem 1.4rem', fontWeight: 700 }}>
                  Valider le Règlement & Réinitialiser le Solde
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════
          MODAL 5 : CONFIRMATION DE SUPPRESSION
         ══════════════════════════════════════════════════════════════ */}
      {deletingConfirmTarget && (
        <div className="modal-backdrop" onClick={() => setDeletingConfirmTarget(null)}>
          <div className="modal-card" style={{ maxWidth: '440px', textAlign: 'center', padding: '1.75rem' }} onClick={(e) => e.stopPropagation()}>
            <div style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>⚠️</div>
            <h3 style={{ margin: '0 0 0.5rem' }}>Confirmer la Suppression</h3>
            <p style={{ fontSize: '0.86rem', color: 'var(--text-muted)', margin: '0 0 1.25rem' }}>
              Êtes-vous sûr de vouloir supprimer définitivement{' '}
              <strong>{deletingConfirmTarget.name}</strong> ? Cette action est irréversible.
            </p>

            <div style={{ display: 'flex', justifyContent: 'center', gap: '0.75rem' }}>
              <button type="button" className="secondary" onClick={() => setDeletingConfirmTarget(null)}>
                Annuler
              </button>
              <button
                type="button"
                className="primary"
                onClick={handleConfirmDelete}
                style={{ background: '#dc2626', borderColor: '#dc2626' }}
              >
                Oui, Supprimer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
