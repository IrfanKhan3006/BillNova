import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';

@Injectable()
export class BusinessService {
  constructor(private prisma: PrismaService) {}

  async getProfile(tenantId: string) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId, deletedAt: null },
      select: {
        id: true,
        name: true,
        slug: true,
        plan: true,
        gstin: true,
        stateCode: true,
        address: true,
        phone: true,
        email: true,
        logoUrl: true,
        customHeaderUrl: true,
        invoicePrefix: true,
        invoiceCounter: true,
        dueDays: true,
        invoiceTemplate: true,
        bankAccountName: true,
        bankAccountNumber: true,
        bankIfsc: true,
        upiId: true,
        createdAt: true,
      },
    });

    if (!tenant) {
      throw new NotFoundException('Business profile not found.');
    }

    return tenant;
  }

  async updateProfile(tenantId: string, updateData: any) {
    // Only allow updating certain fields
    const {
      name,
      gstin,
      stateCode,
      address,
      phone,
      email,
      logoUrl,
      customHeaderUrl,
      invoicePrefix,
      dueDays,
      invoiceTemplate,
      bankAccountName,
      bankAccountNumber,
      bankIfsc,
      upiId,
    } = updateData;

    return this.prisma.tenant.update({
      where: { id: tenantId },
      data: {
        name,
        gstin,
        stateCode,
        address,
        phone,
        email,
        logoUrl,
        customHeaderUrl,
        invoicePrefix,
        dueDays,
        invoiceTemplate,
        bankAccountName,
        bankAccountNumber,
        bankIfsc,
        upiId,
      },
    });
  }

  async getSandboxToken(baseUrl: string): Promise<string> {
    const response = await fetch(`${baseUrl}/authenticate`, {
      method: 'POST',
      headers: {
        'x-api-key': process.env.SANDBOX_GST_API_KEY || '',
        'x-api-secret': process.env.SANDBOX_GST_API_SECRET || '',
        'x-api-version': '1.0.0',
        'accept': 'application/json'
      }
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new BadRequestException(`Sandbox Authentication Failed (Status ${response.status}): ${errText}`);
    }

    const data = await response.json();
    if (!data || !data.access_token) {
      throw new BadRequestException('Access token missing in Sandbox authentication response.');
    }

    return data.access_token;
  }

  async gstFetch(gstin: string) {
    const cleanGst = gstin.trim().toUpperCase();
    if (cleanGst.length !== 15) {
      throw new BadRequestException('GSTIN must be 15 characters long.');
    }

    if (!process.env.SANDBOX_GST_API_KEY || !process.env.SANDBOX_GST_API_SECRET) {
      throw new BadRequestException('Sandbox API Key and API Secret must be configured on the server.');
    }

    const isTestKey = process.env.SANDBOX_GST_API_KEY.includes('test') || process.env.SANDBOX_GST_API_KEY.includes('mock');
    const baseUrl = isTestKey ? 'https://test-api.sandbox.co.in' : 'https://api.sandbox.co.in';

    try {
      // Step 1: Authenticate and get temporary access token
      const accessToken = await this.getSandboxToken(baseUrl);

      // Step 2: Query the public GST validation endpoint
      const response = await fetch(`${baseUrl}/gst/compliance/public/gstin/verify`, {
        method: 'POST',
        headers: {
          'x-api-key': process.env.SANDBOX_GST_API_KEY,
          'authorization': accessToken,
          'x-api-version': '1.0.0',
          'content-type': 'application/json',
          'accept': 'application/json'
        },
        body: JSON.stringify({
          gstin: cleanGst
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new BadRequestException(`Sandbox API Error (Status ${response.status}): ${errorText}`);
      }

      const resJson = await response.json();
      if (!resJson || !resJson.data || !resJson.data.data) {
        throw new NotFoundException('GSTIN details not found in Sandbox response.');
      }

      const gstData = resJson.data.data;
      const addressObj = gstData.pradr?.addr || {};
      let fullAddress = '';
      if (addressObj.bno || addressObj.st || addressObj.loc || addressObj.dst || addressObj.pncd) {
        fullAddress = `${addressObj.bno || ''} ${addressObj.st || ''} ${addressObj.loc || ''} ${addressObj.dst || ''} ${addressObj.stcd || ''} ${addressObj.pncd || ''}`.trim().replace(/\s+/g, ' ');
      } else {
        fullAddress = `Registered business in State of ${gstData.stateName || 'Haryana'}`;
      }

      return {
        name: gstData.legalName || gstData.tradeNam || 'GST Business',
        gstin: cleanGst,
        stateCode: gstData.stateCode || cleanGst.slice(0, 2),
        stateName: gstData.stateName || 'Haryana',
        address: fullAddress,
        phone: '',
        email: ''
      };
    } catch (err: any) {
      if (err instanceof BadRequestException || err instanceof NotFoundException) {
        throw err;
      }
      throw new BadRequestException(`GST Lookup failed: ${err.message}`);
    }
  }
}
