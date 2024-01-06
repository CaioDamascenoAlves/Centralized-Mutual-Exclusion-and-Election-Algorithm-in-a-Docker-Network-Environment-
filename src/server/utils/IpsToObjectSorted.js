function ipsToObjectSorted(ipsString) {
    let ipsArray = ipsString.split(',');
    let ipsKeyValueArray = ipsArray.map(ip => {
        let segments = ip.split('.');
        let lastSegment = segments[segments.length - 1];
        return { key: lastSegment, value: ip };
    });

    // Ordenando o array com base na chave
    ipsKeyValueArray.sort((a, b) => parseInt(a.key) - parseInt(b.key));

    // Convertendo de volta para um objeto
    let sortedIpsObject = {};
    ipsKeyValueArray.forEach(item => {
        sortedIpsObject[item.key] = item.value;
    });

    return sortedIpsObject;
}

module.exports = ipsToObjectSorted;
