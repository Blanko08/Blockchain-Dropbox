import React, { Component } from 'react';
import Navbar from './Navbar'
import Main from './Main'
import Web3 from 'web3';
import './App.css';
import DStorage from '../abis/DStorage.json'

const ipfsClient = require('ipfs-http-client');
const ipfs = ipfsClient({ host: 'ipfs.infura.io', port: 5001, protocol: 'https' });

class App extends Component {

  async componentWillMount() {
    await this.loadWeb3()
    await this.loadBlockchainData()
  }

  async loadWeb3() {
    if(window.ethereum) {
      window.web3 = new Web3(window.ethereum);
      await window.ethereum.request({ method: 'eth_requestAccounts' });
    } else if(window.web3) {
      window.web3 = new Web3(window.web3.currentProvider);
    } else{
      alert('No ethereum browser is installed. Try it installing MetaMask.');
    }
  }

  async loadBlockchainData() {
    const web3 = window.web3;

    const accounts = await web3.eth.getAccounts();
    this.setState({ account: accounts[0] });

    const networkId = await web3.eth.net.getId();
    const netWorkData = DStorage.networks[networkId];

    if(netWorkData) {
      //Assign contract
      const dstorage = new web3.eth.Contract(DStorage.abi, netWorkData.address);
      this.setState({ dstorage });

      //Get files amount
      const filesCount = await dstorage.methods.fileCount().call();
      this.setState({ filesCount });

      //Load files&sort by the newest
      for(var i = filesCount; i >= 1; i--) {
        const file = await dstorage.methods.files(i).call()
        this.setState({
          files: [...this.state.files, file]
        });
      }
    } else {
      alert('DStorage contract not deployed to detected network.');
    }

    this.setState({ loading: false });
  }

  // Get file from user
  captureFile = event => {
    event.preventDefault();

    const file = event.target.files[0];
    const reader = new window.FileReader();

    reader.readAsArrayBuffer(file);
    reader.onloadend = () => {
      this.setState({
        buffer: Buffer(reader.result),
        type: file.type,
        name: file.name
      });
    }
  }


  // Upload File
  uploadFile = description => {
    console.log('Submitting file to IPFS...');

    // Add file to the IPFS
    ipfs.add(this.state.buffer, (error, result) => {
      console.log('IPFS result', result);

      if(error) {
        console.log(error);
        return;
      }

      this.setState({ loading: true })

      // Assign value for the file without extension
      if(this.state.type === '') {
        this.setState({ type: 'none' });
      }

      //Call smart contract uploadFile function 
      this.state.dstorage.methods.uploadFile(result[0].hash, result[0].size, this.state.type, this.state.name, description).send({ from: this.state.account })
      .on('transactionHash', (hash) => {
        this.setState({
          loading: false,
          type: null,
          name: null
        });
        window.location.reload();
      }).on('error', (e) => {
        window.alert('Error');
        this.setState({ loading: false })
      });
    });
  }

  //Set states
  constructor(props) {
    super(props)
    this.state = {
      account: '',
      dstorage: '',
      files: [],
      loading: true,
      type: null,
      name: null
    }

    //Bind functions
  }

  render() {
    return (
      <div>
        <Navbar account={this.state.account} />
        { this.state.loading
          ? <div id="loader" className="text-center mt-5"><p>Loading...</p></div>
          : <Main
              files={this.state.files}
              captureFile={this.captureFile}
              uploadFile={this.uploadFile}
            />
        }
      </div>
    );
  }
}

export default App;