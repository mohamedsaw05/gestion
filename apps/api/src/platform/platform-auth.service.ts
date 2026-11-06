import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as argon2 from 'argon2';
import { PlatformPrismaService } from '../common/platform-prisma.service.js';
import type { PlatformLoginDto } from './dto/platform-login.dto.js';

@Injectable()
export class PlatformAuthService {
  constructor(
    private readonly platform: PlatformPrismaService,
    private readonly jwt: JwtService,
  ) {}

  async login(dto: PlatformLoginDto) {
    const admin = await this.platform.client.platformAdminUser.findUnique({
      where: { email: dto.email.toLowerCase().trim() },
    });

    if (!admin || admin.status !== 'ACTIVE') {
      throw new UnauthorizedException('Identifiants administrateur invalides');
    }

    const isValid = await argon2.verify(admin.passwordHash, dto.password);
    if (!isValid) {
      throw new UnauthorizedException('Identifiants administrateur invalides');
    }

    const accessToken = this.jwt.sign({
      sub: admin.id,
      email: admin.email,
      role: admin.role,
      isPlatformAdmin: true,
    });

    return {
      accessToken,
      admin: {
        id: admin.id,
        email: admin.email,
        fullName: admin.fullName,
        role: admin.role,
      },
    };
  }

  async getMe(adminId: string) {
    const admin = await this.platform.client.platformAdminUser.findUnique({
      where: { id: adminId },
      select: { id: true, email: true, fullName: true, role: true, status: true, createdAt: true },
    });
    if (!admin || admin.status !== 'ACTIVE') {
      throw new UnauthorizedException('Administrateur introuvable ou inactif');
    }
    return admin;
  }
}
