import { StatusBar } from "expo-status-bar";
import { useState, useEffect } from "react";
import { StyleSheet, Text, View, TouchableOpacity, Button } from "react-native";
// Import the crypto getRandomValues shim (**BEFORE** the shims)
import "react-native-get-random-values";
// Import the the ethers shims (**BEFORE** ethers)
import "@ethersproject/shims";
import { ethers } from "ethers";
// Polyfill for localStorage
import "./helpers/windows";
import { useBalance } from "eth-hooks/useBalance";
import { useGasPrice } from "eth-hooks/useGasPrice";
import { useExchangeEthPrice } from "eth-hooks/dapps/dex";
import { useContractLoader } from "eth-hooks/useContractLoader";
// import { useUserProviderAndSigner } from "eth-hooks/useUserProviderAndSigner";
import externalContracts from "./contracts/external_contracts";
import deployedContracts from "./contracts/hardhat_contracts.json";
// import { Transactor, Web3ModalSetup } from "./helpers";
import { useStaticJsonRPC, useUserProviderAndSigner } from "./hooks";

import AsyncStorage from '@react-native-async-storage/async-storage';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import RNPickerSelect from "react-native-picker-select";

import AddressDisplay from "./components/AddressDisplay";
import TokenDisplay from "./components/TokenDisplay";
import { NETWORKS, ALCHEMY_KEY } from "./constants";
import { SendModal } from './screens/SendModal'
import Transactor from "./helpers/Transactor";
import { DisplayQRModal } from "./screens/DisplayQRModal";
import Toast from 'react-native-toast-message';
import { txContext } from './context/txContext';
/// 📡 What chain are your contracts deployed to?
const initialNetwork = NETWORKS.mainnet; // <------- select your target frontend network (localhost, rinkeby, xdai, mainnet)

const DEBUG = true;
const USE_BURNER_WALLET = false; // toggle burner wallet feature

// 🛰 providers
const providers = [
  "https://eth-mainnet.gateway.pokt.network/v1/lb/611156b4a585a20035148406",
  `https://eth-mainnet.alchemyapi.io/v2/${ALCHEMY_KEY}`,
  "https://rpc.scaffoldeth.io:48544",
];

const Stack = createStackNavigator();

export default function App() {
  const networkOptions = [initialNetwork.name, "mainnet", "rinkeby"];

  const [injectedProvider, setInjectedProvider] = useState();
  const [address, setAddress] = useState();
  const [selectedNetwork, setSelectedNetwork] = useState(networkOptions[0]);

  const targetNetwork = NETWORKS[selectedNetwork];

  // 🔭 block explorer URL
  const blockExplorer = targetNetwork.blockExplorer;

  // load all your providers
  const localProvider = useStaticJsonRPC([targetNetwork.rpcUrl]);
  const mainnetProvider = useStaticJsonRPC(providers);

  if (DEBUG) console.log(`Using ${selectedNetwork} network`);

  // 🛰 providers
  if (DEBUG) console.log("📡 Connecting to Mainnet Ethereum");

  /* 💵 This hook will get the price of ETH from 🦄 Uniswap: */
  const price = useExchangeEthPrice(targetNetwork, mainnetProvider);

  /* 🔥 This hook will get the price of Gas from ⛽️ EtherGasStation */
  const gasPrice = useGasPrice(targetNetwork, "fast");


  // Use your injected provider from 🦊 Metamask
  const userProvider =
    useUserProviderAndSigner(
      injectedProvider,
      localProvider,
      USE_BURNER_WALLET
    ) || {};


  // On App load, check async storage for an existing wallet, else generate a 🔥 burner wallet.
  const [userSigner, setUserSigner] = useState();
  useEffect(() => {
    console.log('useEffect App');
    const loadAccountAndNetwork = async () => {
      // FIXME: REFACTOR TO USE SECURE STORAGE
      const pk = await AsyncStorage.getItem('metaPrivateKey')
      let signer;
      if (!pk) {
        const generatedWallet = ethers.Wallet.createRandom();
        const privateKey = generatedWallet._signingKey().privateKey;
        await AsyncStorage.setItem('metaPrivateKey', privateKey)
        signer = generatedWallet.connect(localProvider);
        setUserSigner(generatedWallet);
        setAddress(generatedWallet.address)
      } else {
        const existingWallet = new ethers.Wallet(pk);
        signer = existingWallet.connect(localProvider);
        setUserSigner(existingWallet);
        setAddress(existingWallet.address)
      }

      const cachedNetwork = await AsyncStorage.getItem('network')
      if (cachedNetwork) setSelectedNetwork(cachedNetwork)
    }
    loadAccountAndNetwork()
  }, [])


  // useEffect(() => {
  //   async function getAddress() {
  //     if (userSigner) {
  //       const newAddress = await userSigner.getAddress();
  //       setAddress(newAddress);
  //     }
  //   }
  //   getAddress();
  // }, [userSigner]);


  const sendTxn = async () => {
    const { wallet, targetNetwork } = userSigner;
    console.log(wallet, targetNetwork);

    // await signer.sendTransaction({
    //   to: "0xA00F36889e25249492f93e00852Ba183776DC747",
    //   value: ethers.utils.parseEther("0.01"),
    //   data: ""
    // });

  }

  const options = [];
  for (const id in NETWORKS) {
    options.push(
      { label: NETWORKS[id].name, value: NETWORKS[id].name, color: NETWORKS[id].color }
    );
  }


  // const tx = Transactor(userSigner, gasPrice);


  // You can warn the user if you would like them to be on a specific network
  const localChainId =
    localProvider && localProvider._network && localProvider._network.chainId;
  // const selectedChainId =
  //   userSigner &&
  //   userSigner.provider &&
  //   userSigner.provider._network &&
  //   userSigner.provider._network.chainId;

  // 🏗 scaffold-eth is full of handy hooks like this one to get your balance:
  const yourLocalBalance = useBalance(localProvider, address);

  // Just plug in different 🛰 providers to get your balance on different chains:
  const yourMainnetBalance = useBalance(mainnetProvider, address);

  const contractConfig = {
    deployedContracts: deployedContracts || {},
    externalContracts: externalContracts || {},
  };

  // Load in your local 📝 contract and read a value from it:
  const readContracts = useContractLoader(localProvider, contractConfig);

  useEffect(() => {
    if (DEBUG && mainnetProvider && address && selectedNetwork && yourLocalBalance && yourMainnetBalance) {
      console.log("_____________________________________ 🏗 scaffold-eth _____________________________________")
      console.log("🌎 mainnetProvider", mainnetProvider)
      console.log("🏠 localChainId", localChainId)
      console.log("👩‍💼 selected address:", address)
      console.log("🕵🏻‍♂️ selectedNetwork:", selectedNetwork)
      console.log("💵 yourLocalBalance", yourLocalBalance ? ethers.utils.formatEther(yourLocalBalance) : "...")
      console.log("💵 yourMainnetBalance", yourMainnetBalance ? ethers.utils.formatEther(yourMainnetBalance) : "...")
    }
  }, [mainnetProvider, address, selectedNetwork, yourLocalBalance, yourMainnetBalance, readContracts])


  const copiedToast = () => {
    Toast.show({
      position: 'bottom',
      visibilityTime: 1000,
      type: 'success',
      text1: 'Copied'
    });
  }


  function HomeScreen({ navigation }) {
    return (
      <View style={styles.container}>
        <StatusBar style="auto" />
        <RNPickerSelect
          value={selectedNetwork}
          onValueChange={async (value) => {
            await AsyncStorage.setItem('network', value)
            setSelectedNetwork(value)
          }}
          items={options}
          style={pickerSelectStyles}

        />
        {address &&
          <View style={{ marginTop: 60 }}>
            <AddressDisplay address={address} navigation={navigation} toast={copiedToast} />
            <TokenDisplay tokenBalance={yourLocalBalance} tokenName={'Ether'} tokenSymbol={'ETH'} tokenPrice={price} />
            <View style={{ alignItems: 'center' }}>
              <TouchableOpacity
                style={{ width: 80, height: 36, justifyContent: 'center' }}
                // onPress={sendTxn}
                onPress={() => navigation.navigate('SendModal', { ethPrice: price, targetNetwork })}
              >
                <Text
                  style={styles.textButton}>
                  Send
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        }
        <Toast />
      </View>
    );
  }

  return (
    <txContext.Provider value={userSigner}>
      <NavigationContainer>
        <Stack.Navigator>
          <Stack.Group screenOptions={{ headerShown: false }} >
            <Stack.Screen name="Home" component={HomeScreen} />
          </Stack.Group>
          <Stack.Group screenOptions={{ presentation: 'modal', headerShown: false }} >
            <Stack.Screen name="DisplayQRModal" component={DisplayQRModal} />
            <Stack.Screen name="SendModal" component={SendModal} />
          </Stack.Group>
        </Stack.Navigator>
      </NavigationContainer>
    </txContext.Provider>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'column',
    alignItems: "center",
    paddingHorizontal: 30,
    backgroundColor: "#fff",
    height: '100%'
  },
  text: {
    fontSize: 16,
    textAlign: "center",
    marginBottom: 40,
  },
  textButton: {
    color: '#0E76FD',
    fontSize: 18,
    fontWeight: "600",
    textAlign: "center",
  },
});
const pickerSelectStyles = StyleSheet.create({
  inputIOS: {
    marginHorizontal: '20%',
    width: '60%',
    height: 36,
    fontSize: 20,
    fontWeight: '500',
    textAlign: 'center',
    marginTop: 32,
    color: 'black',
    // backgroundColor: '#eee'
  },
  iconContainer: {
    top: 46,
    right: 100,
  },
  chevronDown: {
    color: '#fff'
  }
});