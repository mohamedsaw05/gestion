import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ScheduleModule } from '@nestjs/schedule';
import { AppController } from './app.controller.js';
import { CommonModule } from './common/common.module.js';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard.js';
import { CapabilityGuard } from './common/guards/capability.guard.js';
import { PermissionGuard } from './common/guards/permission.guard.js';
import { RbacModule } from './rbac/rbac.module.js';
import { AuthModule } from './auth/auth.module.js';
import { MeModule } from './me/me.module.js';
import { CatalogModule } from './catalog/catalog.module.js';
import { InventoryModule } from './inventory/inventory.module.js';
import { SalesModule } from './sales/sales.module.js';
import { AuditModule } from './audit/audit.module.js';
import { CustomersModule } from './customers/customers.module.js';
import { OrganizationModule } from './organization/organization.module.js';
import { DocumentsModule } from './documents/documents.module.js';
import { PricingModule } from './pricing/pricing.module.js';
import { CreditModule } from './credit/credit.module.js';
import { ConfigurationModule } from './config/config.module.js';
import { UnitsModule } from './units/units.module.js';
import { BusinessProfileModule } from './business-profile/business-profile.module.js';
import { CashRegisterModule } from './cash-register/cash-register.module.js';
import { UsersModule } from './users/users.module.js';
import { RolesModule } from './roles/roles.module.js';
import { InvitationsModule } from './invitations/invitations.module.js';
import { OrdersModule } from './orders/orders.module.js';
import { SuppliersModule } from './suppliers/suppliers.module.js';
import { ReturnsModule } from './returns/returns.module.js';
import { WarrantiesModule } from './warranties/warranties.module.js';
import { DeliveriesModule } from './deliveries/deliveries.module.js';
import { PlatformModule } from './platform/platform.module.js';
import { ReportsModule } from './reports/reports.module.js';
import { AlertsModule } from './alerts/alerts.module.js';
import { SocialModule } from './social/social.module.js';
import { ExpensesModule } from './expenses/expenses.module.js';
import { FilesModule } from './files/files.module.js';
import { AutomationModule } from './automation/automation.module.js';
import { DiagnosticsModule } from './diagnostics/diagnostics.module.js';
import { ServicesModule } from './services/services.module.js';
import { AppointmentsModule } from './appointments/appointments.module.js';
import { QuarantineModule } from './quarantine/quarantine.module.js';
import { SupportModule } from './support/support.module.js';
import { LearningModule } from './learning/learning.module.js';
import { PeripheralsModule } from './peripherals/peripherals.module.js';
import { ProgressivePurchasesModule } from './progressive-purchases/progressive-purchases.module.js';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    CommonModule,
    PlatformModule,
    ReportsModule,
    AlertsModule,
    RbacModule,
    BusinessProfileModule,
    AuthModule,
    MeModule,
    CatalogModule,
    InventoryModule,
    SalesModule,
    AuditModule,
    CustomersModule,
    OrganizationModule,
    DocumentsModule,
    PricingModule,
    CreditModule,
    ConfigurationModule,
    UnitsModule,
    CashRegisterModule,
    UsersModule,
    RolesModule,
    InvitationsModule,
    OrdersModule,
    SuppliersModule,
    ReturnsModule,
    WarrantiesModule,
    DeliveriesModule,
    SocialModule,
    ExpensesModule,
    FilesModule,
    AutomationModule,
    DiagnosticsModule,
    ServicesModule,
    AppointmentsModule,
    QuarantineModule,
    SupportModule,
    LearningModule,
    PeripheralsModule,
    ProgressivePurchasesModule,
  ],
  controllers: [AppController],
  providers: [
    // Ordre important : authentification -> capability du commerce ->
    // permission de l'utilisateur (cf docs/architecture/07-securite.md §1-2
    // et la distinction capability/permission de cette phase).
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: CapabilityGuard },
    { provide: APP_GUARD, useClass: PermissionGuard },
  ],
})
export class AppModule {}
