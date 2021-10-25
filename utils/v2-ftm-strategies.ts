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
    address: '0x695a4a6e5888934828cb97a3a7adbfc71a70922d',
  },
  {
    name: 'MIM',
    amount: 2_000_000,
    added: true,
    address: '0xd0d1f041f93c0ff1091457618e529610c67a76de',
  },
  {
    name: 'USDC',
    amount: 2_000_000,
    added: false,
    address: '',
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
