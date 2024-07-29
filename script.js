document.getElementById('currencyForm').addEventListener('submit', function (event) {
	event.preventDefault();
	createCurrency();
});

async function createCurrency() {
	const statusMessage = document.getElementById('statusMessage');

	// Retrieve form values
	const issuerSeed = document.getElementById('issuerSeed').value;
	const distributionSeed = document.getElementById('distributionSeed').value;
	var currencyCode = document.getElementById('currencyCode').value;
	const totalSupply = document.getElementById('totalSupply').value;
	const networkAddress = document.getElementById('networkAddress').value;

	// Update status message
	statusMessage.innerHTML = `Connecting to ${networkAddress} ...<br>`;

	// Create a new client instance and try to connect
	let client = null;
	try {
		client = new xrpl.Client(networkAddress);
		await client.connect();

		statusMessage.innerHTML += `Connected to Network.<br>`;

	} catch (e) {
		statusMessage.innerHTML += `Error when connecting - <br>${e.message}`;
		return;
	}

	const currencyIssuerWallet = xrpl.Wallet.fromSeed(issuerSeed);
	statusMessage.innerHTML += `Currency Issuer Address is: ${currencyIssuerWallet.address}<br>`;

	// Set account flags
	statusMessage.innerHTML += `Setting Default Ripple Flag<br>`;
	try {
		settings_tx = {
			"TransactionType": "AccountSet",
			"Account": currencyIssuerWallet.address,
			"SetFlag": xrpl.AccountSetAsfFlags.asfDefaultRipple
		}
		const prepared = await client.autofill(settings_tx);
		const signed = currencyIssuerWallet.sign(prepared);
		const result = await client.submitAndWait(signed.tx_blob)
		if (result.result.meta.TransactionResult == "tesSUCCESS") {
			statusMessage.innerHTML += 'Account setting succeeded. <br>';
		} else {
			statusMessage.innerHTML += 'Account setting failed.<br>'
			return;
		}
	} catch (e) {
		statusMessage.innerHTML += 'Failed to set flags with error - <br>';
		statusMessage.innerHTML += `<br>${e.message}<br>`;
		return;
	}

	// Get distribution wallet and set trustline
	if (currencyCode.length > 3) {
		currencyCode =  xrpl.convertStringToHex(currencyCode);
		while (currencyCode.length < 40) {
			currencyCode += `0`;
		}
	}

	statusMessage.innerHTML += 'Setting trustline from Distributer to Issuer<br>';
	const distributionWallet = xrpl.Wallet.fromSeed(distributionSeed);
	try {
		const trustSet_tx = {
			"TransactionType": "TrustSet",
			"Account": distributionWallet.address,
			"LimitAmount": {
				"currency": currencyCode,
				"issuer": currencyIssuerWallet.address,
				"value": totalSupply
			}
		}
		const ts_prepared = await client.autofill(trustSet_tx)
		const ts_signed = distributionWallet.sign(ts_prepared)
		const ts_result = await client.submitAndWait(ts_signed.tx_blob)
		if (ts_result.result.meta.TransactionResult == "tesSUCCESS") {
			statusMessage.innerHTML += 'Trustline created. <br>';
		} else {
			statusMessage.innerHTML += 'Failed to create trustline <br>';
			return;
		}
	} catch (e) {
		statusMessage.innerHTML += 'Failed to create trustline with error - <br>';
		statusMessage.innerHTML += `<br>${e.message}<br>`;
		return;
	}

	// Send total supply to Distribution wallet
	statusMessage.innerHTML += 'Sending supply to Distribution wallet...<br>';
	try {
		const send_token_tx = {
			"TransactionType": "Payment",
			"Account": currencyIssuerWallet.address,
			"Amount": {
				"currency": currencyCode,
				"value": totalSupply,
				"issuer": currencyIssuerWallet.address
			},
			"Destination": distributionWallet.address
		}
		const pay_prepared = await client.autofill(send_token_tx)
		const pay_signed = currencyIssuerWallet.sign(pay_prepared)
		const pay_result = await client.submitAndWait(pay_signed.tx_blob)
		if (pay_result.result.meta.TransactionResult == "tesSUCCESS") {
			statusMessage.innerHTML += 'Successfully sent currency...<br>';
			statusMessage.innerHTML += `Transaction hash - ${pay_signed.hash}<br>`;
		} else {
			statusMessage.innerHTML += 'Transaction failed...<br>';
			return;
		}
	} catch (e) {
		statusMessage.innerHTML += 'Failed to send tokens with error - <br>';
		statusMessage.innerHTML += `<br>${e.message}<br>`;
		return;
	}

	statusMessage.innerHTML += '<br>Finished creating your currency, it is advisaed to Blackhole your Currency Issuer Account<br>';
	await client.disconnect();
	return;
}
