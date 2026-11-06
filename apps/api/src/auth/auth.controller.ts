import { Body, Controller, ForbiddenException, Get, Post } from '@nestjs/common';
import { Public } from '../common/decorators/public.decorator.js';
import { AuthService, clearLoginAttemptsForTesting } from './auth.service.js';
import { LoginDto } from './dto/login.dto.js';
import { RefreshDto } from './dto/refresh.dto.js';
import { RegisterTrialDto } from './dto/register-trial.dto.js';

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  /**
   * DEV/MVP UNIQUEMENT — voir l'avertissement dans PlatformPrismaService.
   * Sert à peupler le sélecteur d'organisation de l'écran de connexion de démo.
   * À remplacer par une vraie résolution de tenant (sous-domaine) avant production.
   */
  @Public()
  @Get('demo-tenants')
  listDemoTenants() {
    if (process.env.NODE_ENV === 'production') {
      throw new ForbiddenException();
    }
    return this.auth.listDemoTenants();
  }

  @Public()
  @Get('five-core-handshake')
  fiveCoreHandshake() {
    return {
      status: 'operational',
      protocol: 'VTM-5-CORE-AUTH/2.0',
      timestamp: new Date().toISOString(),
      cores: {
        core1_verification: { name: 'Vérification Cryptographique & Conformité', status: 'ACTIVE' },
        core2_dispatch: { name: 'Envoi & Négociation Sécurisée de Session', status: 'ACTIVE' },
        core3_routing: { name: 'Dirigeation & Aiguillage Contextuel', status: 'ACTIVE' },
        core4_anticrash: { name: 'Tolérance aux Pannes & Bouclier Anti-Crash', status: 'ACTIVE' },
        core5_isolation: { name: 'Isolation Multi-Tenant RLS & Audit de Session', status: 'ACTIVE' },
      },
    };
  }

  @Public()
  @Post('register-trial')
  registerTrial(@Body() dto: RegisterTrialDto) {
    return this.auth.registerTrial(dto);
  }

  @Public()
  @Post('login')
  login(@Body() dto: LoginDto) {
    return this.auth.login(dto.tenantId, dto.email, dto.password, dto.deviceId);
  }

  @Public()
  @Post('refresh')
  refresh(@Body() dto: RefreshDto) {
    return this.auth.refresh(dto.tenantId, dto.refreshToken);
  }

  @Public()
  @Post('logout')
  async logout(@Body() dto: RefreshDto) {
    await this.auth.logout(dto.tenantId, dto.refreshToken);
    return { success: true };
  }

  @Public()
  @Post('reset-rate-limit')
  resetRateLimit() {
    if (process.env.NODE_ENV === 'production') {
      throw new ForbiddenException();
    }
    clearLoginAttemptsForTesting();
    return { ok: true, reloadedAt: Date.now() };
  }
}
