import { Global, Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PrismaTenantService } from './prisma-tenant.service.js';
import { PlatformPrismaService } from './platform-prisma.service.js';

@Global()
@Module({
  imports: [
    JwtModule.register({
      secret: process.env.JWT_ACCESS_SECRET,
      signOptions: { expiresIn: (process.env.JWT_ACCESS_TTL ?? '15m') as unknown as number },
    }),
  ],
  providers: [PrismaTenantService, PlatformPrismaService],
  exports: [JwtModule, PrismaTenantService, PlatformPrismaService],
})
export class CommonModule {}
