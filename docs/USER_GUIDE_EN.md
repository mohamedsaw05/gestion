# Complete User Manual for Store Management (English)

Welcome to the official user manual for the **Universal Commerce Store Manager**.
This guide is tailored specifically for shop owners, retail merchants, sales clerks, cashiers, and warehouse managers. It explains every daily store operation in simple, step-by-step, plain language without confusing technical jargon.

---

## Table of Contents

1. [Introduction & Core Principles](#1-introduction--core-principles)
2. [First Steps & Store Configuration](#2-first-steps--store-configuration)
3. [Product Catalog: Adding, Organizing & Pricing Products](#3-product-catalog-adding-organizing--pricing-products)
4. [Counter Sales & Point-of-Sale (Checkout & POS)](#4-counter-sales--point-of-sale-checkout--pos)
5. [Daily Cash Drawer Management (Morning, Daytime, Evening Closing)](#5-daily-cash-drawer-management-morning-daytime-evening-closing)
6. [Customer Credit & Receivables (Ledger & Debt Repayments)](#6-customer-credit--receivables-ledger--debt-repayments)
7. [Inventory Tracking, Low Stock Alerts & Physical Stock Count](#7-inventory-tracking-low-stock-alerts--physical-stock-count)
8. [Stock Transfers Between Warehouses & Retail Stores](#8-stock-transfers-between-warehouses--retail-stores)
9. [Supplier Orders & Restocking Goods](#9-supplier-orders--restocking-goods)
10. [Recording Operating Expenses & Overhead Costs](#10-recording-operating-expenses--overhead-costs)
11. [Customer Returns, Exchanges & Credit Vouchers](#11-customer-returns-exchanges--credit-vouchers)
12. [Understanding Your Numbers: Daily Revenue, Margins & Profit](#12-understanding-your-numbers-daily-revenue-margins--profit)
13. [Backups, Full Data Portability & Guaranteed Ownership](#13-backups-full-data-portability--guaranteed-ownership)
14. [Helpful Keyboard Shortcuts & Pro Tips](#14-helpful-keyboard-shortcuts--pro-tips)

---

## 1. Introduction & Core Principles

The Store Manager was designed with one clear mission: **to make daily retail management effortless and to secure every penny entering or leaving your business**.

### Three Golden Rules:
1. **Full Transparency & Audit Trail:** Every sale, item movement, and expense records the exact date, time, and team member who performed the action. Nothing can disappear secretly.
2. **Business Continuity:** Even if the business owner or director is away on travel or doesn't log in for weeks, cashiers and sales staff can continue serving shoppers with zero downtime.
3. **Exclusive Data Ownership:** Your customer lists, stock data, sales history, and financial figures belong 100% to you. You can export everything to your local computer in Excel/CSV or SQL format at any time.

---

## 2. First Steps & Store Configuration

### 2.1 Setting your business identity
Upon your first login:
1. Click **Settings** in the left sidebar, then click **Business Profile**.
2. Enter your business or trade name (e.g., *Savadogo Trading & Retail Co.*).
3. Provide your physical storefront address, official phone number, and contact email. These details will automatically appear on all printed customer receipts.
4. Verify your base currency (e.g., `XOF` for West African CFA Francs, or `EUR` / `USD`).

### 2.2 Adding physical stores and storage depots
If your business has a retail storefront and a separate storage depot:
1. Go to **Settings** > **Configuration**.
2. Create your sales location (e.g., *Main Retail Store*) where counter sales take place.
3. Create your storage location (e.g., *Central Warehouse*) where bulk supplier shipments arrive.
4. Each store location has its own separate cash register and invoice numbering for pristine accounting.

### 2.3 Inviting your staff with dedicated accounts
To ensure employees never share login credentials:
1. Go to **Settings** > **Users**.
2. Click **+ Invite Collaborator**.
3. Enter their name, email, and choose their role:
   - **Cashier / Sales Clerk:** Can checkout sales, search articles, and print receipts. Cannot alter purchase costs or view total business profits.
   - **Stock Keeper:** Can receive supplier shipments, prepare transfer dispatches, and conduct physical inventory counts.
   - **Store Manager / Owner:** Has full access to financial reports, gross margins, and user permissions.

---

## 3. Product Catalog: Adding, Organizing & Pricing Products

### 3.1 Adding a new product step-by-step
1. Click **Catalog & Stock** > **Products**.
2. Click the blue button **+ New Product**.
3. Fill in the core details:
   - **Product Name:** Use clear, descriptive names (e.g., *Binatone 16-Inch Stand Fan with Timer* instead of just *Fan*).
   - **SKU Reference:** A short internal reference code (e.g., *FAN-BIN-16*).
   - **Selling Price:** Public retail price (e.g., *24,000 XOF*).
   - **Unit of Measure:** Pick *piece*, *box*, *pack*, *kg*, or *liter*.
   - **Product Type:**
     - *Physical Product:* Stored on your shelves and deducted upon sale.
     - *Service:* Repair, maintenance, or home delivery (no inventory deducted).
     - *Bundle / Pack:* A bundle of multiple products sold together under one price.
4. Click **Create Product**.

### 3.2 Assigning a barcode for barcode scanners
To speed up counter checkouts:
1. Open the product from your catalog and click **⚙️ Manage**.
2. In the *Barcodes* section, place your cursor in the input and **scan the barcode on the product packaging with your handheld scanner**.
3. The digits fill in automatically. Click **Add**. Now, scanning this barcode at checkout instantly selects the item!

---

## 4. Counter Sales & Point-of-Sale (Checkout & POS)

The sales screen was crafted for extreme speed, high legibility, and high-volume rush hours.

### 4.1 Processing a sale in 4 easy steps
1. **Open Checkout:** Click **New Sale** in the menu or press **Ctrl + K** on your keyboard.
2. **Select the Item:**
   - Click the search area. Type the first few letters of the product name OR scan the barcode.
   - The selector displays a large, prominent product card showing name, brand, SKU, price, and local stock level.
   - Click it or press **Enter** to add it to the cart.
3. **Adjust Quantity:**
   - Use the **[-]** and **[+]** stepper buttons to change the quantity, or type the number directly.
   - Line totals recalculate instantly with high-contrast formatting (e.g., *48,000 XOF*).
   - To add more items, click **+ Add Line**.
4. **Checkout and Confirm:**
   - If paid in cash, keep *Full Cash Payment* checked.
   - If paid with **Mobile Money (Wave, Orange Money, Moov)**, card, or transfer, choose the appropriate option.
   - Click the big green **Confirm Sale** button.
   - The official receipt appears immediately on screen, ready for printing, while stock adjusts in real time!

### 4.2 What if an item is out of stock in the shop but available in the warehouse?
When you pick an item that is out of stock in your storefront, the selector alerts you in red and displays:
`📦 Available in other depots: Central Warehouse (35 pieces)`
A blue button **Transfer here ⇄** appears. With one click, you can request stock from the warehouse without discarding your sale!

---

## 5. Daily Cash Drawer Management (Morning, Daytime, Evening Closing)

Disciplined cash drawer tracking eliminates shortages and unaccounted cash outflows.

### 5.1 Morning Opening Float
1. Go to **Sales & Cash** > **Cash Register**.
2. Click **Open Cash Session**.
3. Count the starting change in your drawer (the *opening float*, e.g., *20,000 XOF*) and enter the amount.
4. Confirm: your daily shift is officially open.

### 5.2 Daytime Cash Inflows & Outflows
- Every cash sale automatically increases expected cash in the drawer.
- If you pay a small operational expense from the drawer (e.g., *3,000 XOF* for printer paper), log the expense in the **Expenses** menu under *Cash*. The drawer balance is deducted automatically without double data entry!

### 5.3 Evening Closing & Reconciliation
1. At the end of the shift, remove all notes and coins from the drawer and physically count your cash.
2. Click **Close Session**.
3. Enter the exact physical count you have in your hands.
4. The system calculates the variance:
   - If variance is **0 XOF**: perfect balance, zero loss.
   - If there is a discrepancy (surplus or shortage), you can write an explanation note for management.

---

## 6. Customer Credit & Receivables (Ledger & Debt Repayments)

Serving trusted repeat shoppers on credit helps grow your business when properly monitored.

### 6.1 Recording a credit sale
1. During checkout, select the customer name (or click *+ New Customer* to add them with their phone number).
2. In the payment section, uncheck *Full Cash Payment*.
3. Choose **Customer Credit**.
4. If the customer makes a partial down payment (e.g., *15,000 XOF of 50,000 XOF total*), enter the amount collected.
5. Confirm: the receipt indicates the down payment and remaining balance due (*35,000 XOF*). The customer's debt is updated automatically.

### 6.2 Checking outstanding customer debts
1. Open **Credit & Receivables** > **Customer Accounts**.
2. Review all buyers with outstanding balances, sorted by balance size and days overdue.
3. Total outstanding store receivables are summarized at the top.

### 6.3 Recording a debt repayment
When the customer returns to repay:
1. Open their profile in **Customer Accounts**.
2. Click the green button **Record Payment**.
3. Enter the amount paid (e.g., *20,000 XOF*) and the payment method (cash, Wave, Orange Money).
4. Confirm: a repayment receipt is generated and the debt drops by 20,000 XOF immediately.

---

## 7. Inventory Tracking, Low Stock Alerts & Physical Stock Count

### 7.1 Real-time stock levels
In **Catalog & Stock** > **Stock Levels**, monitor your store inventory:
- **🟢 Green (In Stock):** Ample quantities to serve customers.
- **🟠 Orange (Low Stock):** Approaching minimum threshold; time to order from suppliers.
- **🔴 Red (Out of Stock):** Quantity at zero; checkout locks sales to prevent unfulfillable orders.

### 7.2 Conducting monthly physical stock counts
Periodically verify that digital numbers match physical goods on your shelves:
1. Go to **Stock** > **Inventory Reconciliation**.
2. Physically count boxes and pieces on your shelves.
3. Type the actual counted count next to each item.
4. The system computes variances (positive or negative) and recalibrates inventory based on reality.
5. Every adjustment is logged with employee name and reason (damage, expiry, sample...).

---

## 8. Stock Transfers Between Warehouses & Retail Stores

Safeguard goods during inter-location transit:

1. Go to **Catalog & Stock** > **Stock Transfers**.
2. Click **+ New Transfer**.
3. Pick source location (e.g., *Central Warehouse*) and destination (e.g., *Downtown Store*).
4. Select items and quantities to ship.
5. Click **Confirm Dispatch**: stock leaves source inventory and enters **IN TRANSIT** status.
6. When packages arrive at the destination store, the receiving clerk inspects the delivery and clicks **Confirm Receipt**.
7. Store inventory increases officially. Until confirmed, transit responsibility remains with the carrier.

---

## 9. Supplier Orders & Restocking Goods

1. Register your distributors in **Purchases & Suppliers** > **Suppliers**.
2. To reorder inventory, create a purchase order in **Purchase Orders**.
3. Specify products, order quantities, and agreed wholesale unit costs.
4. When supplier trucks deliver to your warehouse, click **Receive Delivery**.
5. Stock quantities increase automatically without manual retyping!
6. The system updates your weighted average cost to calculate exact gross profit on future sales.

---

## 10. Recording Operating Expenses & Overhead Costs

Keep track of true net earnings by recording day-to-day business expenses:

1. Click **Reports & Control** > **Expenses & Charges**.
2. Click **+ New Expense**.
3. Enter amount and category:
   - *Store Rent*
   - *Electricity & Water Bills*
   - *Staff Salaries & Wages*
   - *Logistics & Delivery Fuel*
   - *Office Supplies & Packaging*
   - *Maintenance & Repairs*
4. Type a clear description (e.g., *May electricity bill for downtown shop*).
5. Specify payment method: if paid in cash from the register, funds are deducted from the active cash session immediately!
6. You can attach a photo or PDF copy of the receipt.

---

## 11. Customer Returns, Exchanges & Credit Vouchers

When a customer returns a defective article or needs another size:

1. Open **Sales & Cash** > **Returns**.
2. Click **+ New Return** and find the original sale by receipt number.
3. Check the returned item and specify quantity.
4. Choose the reason (factory defect, wrong size/color, etc.).
5. Specify item destination:
   - *Return to sellable stock* (if packaging is intact).
   - *Quarantine* (if defective and destined for supplier return).
6. Choose compensation: cash refund, store credit voucher, or direct exchange.
7. Confirm: stock and financial accounts adjust instantly.

---

## 12. Understanding Your Numbers: Daily Revenue, Margins & Profit

Master your store performance without an accounting degree:

1. **Dashboard Home Page:**
   - **Gross Revenue:** Total merchandise sold.
   - **Collected Cash:** Real money collected (cash + mobile money + bank transfers).
   - **Total Expenses:** Operating funds spent to run the store.
   - **Net Profit:** Collected funds minus expenses and cost of goods sold.
2. **Reports Page:**
   - View daily, weekly, or monthly sales charts.
   - Consult the **Top Selling Products** table to know what to reorder in volume.

---

## 13. Backups, Full Data Portability & Guaranteed Ownership

Your business data belongs exclusively to you:

1. Go to **Settings** > **Configuration**.
2. Under *Data Portability & Backup*, two direct download formats are available:
   - **Download JSON Archive:** Comprehensive export readable by office tools and external applications.
   - **Download Standalone PostgreSQL SQL:** Complete database dump ready to restore on any private PostgreSQL database server.
3. You can download backups to a local USB flash drive or hard disk anytime, for free.

---

## 14. Helpful Keyboard Shortcuts & Pro Tips

| Shortcut | Action |
| :--- | :--- |
| **Ctrl + K** | Opens the universal navigation and search bar from any screen in the app. |
| **Esc (Escape)** | Immediately closes open menus or search popovers without saving changes. |
| **Enter Key** | Confirms your selection in the quick search dropdown. |
| **Arrow Keys ↑ / ↓** | Navigate through search results without touching the mouse. |
| **Barcode Scanner** | Scan on the sales screen: items are automatically recognized and added to the cart. |

---

*The Store Manager is built to accompany your business growth every day. For further help, explore the built-in Help Center or contact your system administrator.*
