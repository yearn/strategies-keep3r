import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/dist/src/signers';
import { GnosisSafe } from '@typechained';
import axios from 'axios';
import { bufferToHex, ecrecover, pubToAddress } from 'ethereumjs-util';

export async function getSafeQueuedTransactions(chainId: number, safeAddress: string) {
  try {
    const res = await axios.get(`https://safe-client.gnosis.io/v1/chains/${chainId}/safes/${safeAddress}/transactions/queued`);
    return res.data.results
      .filter((result: { type: string }) => result.type === 'TRANSACTION')
      .map((result: { transaction: any }) => result.transaction);
  } catch (error) {
    console.error(error);
    return;
  }
}
export async function getTransaction(chainId: number, id: string) {
  try {
    const res = await axios.get(`https://safe-client.gnosis.io/v1/chains/${chainId}/transactions/${id}`);
    return res.data;
  } catch (error) {
    console.error(error);
    return;
  }
}

export async function getGasPrice() {
  try {
    const res = await axios.get(`https://www.gasnow.org/api/v3/gas/price`);
    return res.data.data;
  } catch (error) {
    console.error(error);
    return;
  }
}

const EIP712_DOMAIN = [
  {
    type: 'uint256',
    name: 'chainId',
  },
  {
    type: 'address',
    name: 'verifyingContract',
  },
];

export const getEip712MessageTypes = () => {
  return {
    EIP712Domain: EIP712_DOMAIN,
    SafeTx: [
      { type: 'address', name: 'to' },
      { type: 'uint256', name: 'value' },
      { type: 'bytes', name: 'data' },
      { type: 'uint8', name: 'operation' },
      { type: 'uint256', name: 'safeTxGas' },
      { type: 'uint256', name: 'baseGas' },
      { type: 'uint256', name: 'gasPrice' },
      { type: 'address', name: 'gasToken' },
      { type: 'address', name: 'refundReceiver' },
      { type: 'uint256', name: 'nonce' },
    ],
  };
};

export type TxArgs = {
  baseGas: string;
  data: string;
  gasPrice: string;
  gasToken: string;
  nonce: number;
  operation: number;
  refundReceiver: string;
  safeTxGas: string;
  sender?: string;
  to: string;
  valueInWei: string;
};
interface SigningTxArgs extends TxArgs {
  safeAddress: string;
  networkId: string;
}

export const generateTypedDataFrom = async ({
  networkId,
  safeAddress,
  baseGas,
  data,
  gasPrice,
  gasToken,
  nonce,
  operation,
  refundReceiver,
  safeTxGas,
  to,
  valueInWei,
}: SigningTxArgs) => {
  const typedData = {
    types: getEip712MessageTypes(),
    domain: {
      chainId: networkId,
      verifyingContract: safeAddress,
    },
    primaryType: 'SafeTx',
    message: {
      to,
      value: valueInWei,
      data,
      operation,
      safeTxGas,
      baseGas,
      gasPrice,
      gasToken,
      refundReceiver,
      nonce: nonce,
    },
  };
  return typedData;
};

export const getEIP712Signature = async (signer: SignerWithAddress, txArgs: SigningTxArgs, version?: string): Promise<string> => {
  const typedData = await generateTypedDataFrom(txArgs);

  let method = 'eth_signTypedData_v3';
  if (version === 'v4') {
    method = 'eth_signTypedData_v4';
  }
  if (!version) {
    method = 'eth_signTypedData';
  }

  const jsonTypedData = JSON.stringify(typedData);
  const signature = await signer.signMessage(jsonTypedData);
  const sig = adjustV('eth_signTypedData', signature);
  return sig.replace('0x', '');
};

export const isTxHashSignedWithPrefix = (txHash: string, signature: string, ownerAddress: string): boolean => {
  let hasPrefix;
  try {
    const rsvSig = {
      r: Buffer.from(signature.slice(2, 66), 'hex'),
      s: Buffer.from(signature.slice(66, 130), 'hex'),
      v: parseInt(signature.slice(130, 132), 16),
    };
    const recoveredData = ecrecover(Buffer.from(txHash.slice(2), 'hex'), rsvSig.v, rsvSig.r, rsvSig.s);
    const recoveredAddress = bufferToHex(pubToAddress(recoveredData));
    hasPrefix = !sameString(recoveredAddress, ownerAddress);
  } catch (e) {
    hasPrefix = true;
  }
  return hasPrefix;
};

export const sameString = (str1: string | undefined, str2: string | undefined): boolean => {
  if (!str1 || !str2) {
    return false;
  }

  return str1.toLowerCase() === str2.toLowerCase();
};

type AdjustVOverload = {
  (signingMethod: 'eth_signTypedData', signature: string): string;
  (signingMethod: 'eth_sign', signature: string, safeTxHash: string, sender: string): string;
};

export const adjustV: AdjustVOverload = (
  signingMethod: 'eth_sign' | 'eth_signTypedData',
  signature: string,
  safeTxHash?: string,
  sender?: string
): string => {
  const MIN_VALID_V_VALUE = 27;
  let sigV = parseInt(signature.slice(-2), 16);

  if (signingMethod === 'eth_sign') {
    /* 
      Usually returned V (last 1 byte) is 27 or 28 (valid ethereum value)
      Metamask with ledger returns v = 01, this is not valid for ethereum
      In case V = 0 or 1 we add it to 27 or 28
      Adding 4 is required if signed message was prefixed with "\x19Ethereum Signed Message:\n32"
      Some wallets do that, some wallets don't, V > 30 is used by contracts to differentiate between prefixed and non-prefixed messages
      https://github.com/gnosis/safe-contracts/blob/main/contracts/GnosisSafe.sol#L292
    */
    if (sigV < MIN_VALID_V_VALUE) {
      sigV += MIN_VALID_V_VALUE;
    }
    const adjusted = signature.slice(0, -2) + sigV.toString(16);
    const signatureHasPrefix = isTxHashSignedWithPrefix(safeTxHash as string, adjusted, sender as string);
    if (signatureHasPrefix) {
      sigV += 4;
    }
  }

  if (signingMethod === 'eth_signTypedData') {
    // Metamask with ledger returns V=0/1 here too, we need to adjust it to be ethereum's valid value (27 or 28)
    if (sigV < MIN_VALID_V_VALUE) {
      sigV += MIN_VALID_V_VALUE;
    }
  }

  return signature.slice(0, -2) + sigV.toString(16);
};

export interface SafeTransaction {
  id: string;
  timestamp: number;
  txStatus: 'AWAITING_CONFIRMATIONS' | 'AWAITING_EXECUTION';
  txInfo: {
    type: string; // "Custom",
    to: {
      value: string;
    };
    dataSize: string;
    value: string;
    methodName: string;
    isCancellation: boolean;
  };
  executionInfo: {
    type: string; // "MULTISIG",
    nonce: number;
    confirmationsRequired: number;
    confirmationsSubmitted: number;
    missingSigners?: { value: string }[];
  };
}

export interface SafeTransactionData {
  // "executedAt":null,
  // "txStatus":"AWAITING_EXECUTION",
  // "txInfo":{
  //   "type":"Custom",
  //   "to":{
  //     "value":"0x23DC650A7760cA37CafD14AF5f1e0ab62cE50FA4"
  //   },
  //   "dataSize":"36",
  //   "value":"0",
  //   "methodName":"setGuard",
  //   "isCancellation":false
  // },
  txData: {
    hexData: string;
    dataDecoded: {
      method: string;
      parameters: {
        name: string;
        type: string;
        value: string;
      }[];
    };
    to: {
      value: string;
    };
    value: string;
    operation: number;
  };
  detailedExecutionInfo: {
    type: string; //"MULTISIG",
    submittedAt: number;
    nonce: number;
    safeTxGas: string;
    baseGas: string;
    gasPrice: string;
    gasToken: string;
    refundReceiver: {
      value: string;
    };
    safeTxHash: string;
    executor: null;
    signers: { value: string }[];
    confirmationsRequired: number;
    confirmations: {
      signer: {
        value: string;
      };
      signature: string;
      submittedAt: number;
    }[];
  };
  // "txHash":null
}
