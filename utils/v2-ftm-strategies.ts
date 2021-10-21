import { BigNumberish } from 'ethers';
import { e18, ZERO_ADDRESS } from './web3-utils';

export interface v2Strategy {
  name: string;
  added: boolean;
  amount: BigNumberish;
  address: string;
  costToken?: string;
  costPair?: string;
}

export const v2FtmHarvestStrategies: v2Strategy[] = [
  {
    name: 'WFTM',
    amount: 2_000_000,
    added: true,
    address: '0x5920892f23967728E16135c21aB8BeEC8C548927',
  },
  {
    name: 'MIM',
    amount: 2_000_000,
    added: true,
    address: '0xf6ee87BedC9fE2c99Fed5AF90794806F53cF9f11',
  },
  {
    name: 'USDC',
    amount: 2_000_000,
    added: true,
    address: '0xF39E31D1bC0D43A0eb755f758d01fd70bECee471',
  },
  {
    name: 'DAI',
    amount: 2_000_000,
    added: true,
    address: '0xd025b85db175EF1b175Af223BD37f330dB277786',
  },
  {
    name: 'YFI',
    amount: 2_000_000,
    added: true,
    address: '0xDf262B43bea0ACd0dD5832cf2422e0c9b2C539dc',
  },
];

export const v2FtmTendStrategies: v2Strategy[] = [];
