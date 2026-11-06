import { IsIn, IsNumberString, IsOptional, IsString } from 'class-validator';

export class FileListFilterDto {
  @IsOptional()
  @IsIn(['DOCUMENT', 'EXPENSE_RECEIPT', 'PRODUCT_IMAGE', 'LOGO', 'EXPORT', 'BACKUP', 'ATTACHMENT'])
  category?: string;

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsNumberString()
  page?: string;

  @IsOptional()
  @IsNumberString()
  limit?: string;
}

export class UploadMetadataDto {
  @IsOptional()
  @IsIn(['DOCUMENT', 'EXPENSE_RECEIPT', 'PRODUCT_IMAGE', 'LOGO', 'EXPORT', 'BACKUP', 'ATTACHMENT'])
  category?: string;

  @IsOptional()
  @IsString()
  isPublic?: string;
}
