import { IsObject, IsString } from 'class-validator';

export class CompleteOnboardingDto {
  @IsString()
  businessType!: string;

  @IsObject()
  capabilities!: Record<string, boolean>;

  @IsObject()
  modules!: Record<string, boolean>;
}
