import React, { useState, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, FlatList, StyleSheet,
  ScrollView, Alert, Modal, Share, Image, Platform, SafeAreaView,
  KeyboardAvoidingView
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as ImagePicker from 'expo-image-picker';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { BarCodeScanner } from 'expo-barcode-scanner';
import { BluetoothEscposPrinter, BluetoothManager } from 'react-native-thermal-receipt-printer-image-qr';

const DEFAULT_MENU = [
  { id: 1, name: 'Ayam Bakar Taliwang', price: 35000, category: 'Makanan', barcode: '', image: null },
  { id: 2, name: 'Plecing Kangkung', price: 15000, category: 'Makanan', barcode: '', image: null },
  { id: 3, name: 'Sate Bulayak', price: 25000, category: 'Makanan', barcode: '', image: null },
  { id: 4, name: 'Es Teh Manis', price: 6000, category: 'Minuman', barcode: '', image: null },
  { id: 5, name: 'Es Kelapa Muda', price: 12000, category: 'Minuman', barcode: '', image: null },
  { id: 6, name: 'Keripik Singkong', price: 10000, category: 'Camilan', barcode: '', image: null },
];

const formatRupiah = (num) => 'Rp ' + Math.round(num).toLocaleString('id-ID');

function MenuManageItem({ item, onUpdate, onDelete, pickImg }) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(item.name);
  const [price, setPrice] = useState(item.price.toString());
  const [category, setCategory] = useState(item.category || '');
  const [barcode, setBarcode] = useState(item.barcode || '');
  const [image, setImage] = useState(item.image || null);

  const handleImg = async (src) => {
    const img = await pickImg(src);
    if (img) setImage(img);
  };

  if (editing) {
    return (
      <View style={styles.manageItem}>
        <TextInput style={styles.input} value={name} onChangeText={setName} placeholder="Nama" />
        <TextInput style={styles.input} value={price} onChangeText={setPrice} keyboardType="numeric" placeholder="Harga" />
        <TextInput style={styles.input} value={category} onChangeText={setCategory} placeholder="Kategori" />
        <TextInput style={styles.input} value={barcode} onChangeText={setBarcode} placeholder="Barcode" />
        <View style={{ flexDirection: 'row', gap: 6, marginBottom: 8 }}>
          <TouchableOpacity style={styles.imgBtn} onPress={() => handleImg('library')}>
            <Text style={{ fontSize: 12 }}>🖼️ Galeri</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.imgBtn} onPress={() => handleImg('camera')}>
            <Text style={{ fontSize: 12 }}>📷 Kamera</Text>
          </TouchableOpacity>
        </View>
        {image ? <Image source={{ uri: image }} style={{ width: 80, height: 80, borderRadius: 8, marginBottom: 8 }} /> : null}
        <View style={{ flexDirection: 'row', gap: 6 }}>
          <TouchableOpacity
            style={[styles.smallBtn, { backgroundColor: '#2e7d32' }]}
            onPress={() => {
              onUpdate(item.id, { name, price: parseFloat(price) || 0, category, barcode, image });
              setEditing(false);
            }}
          >
            <Text style={{ color: '#fff', fontWeight: 'bold' }}>Simpan</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.smallBtn, { backgroundColor: '#ccc' }]} onPress={() => setEditing(false)}>
            <Text style={{ fontWeight: 'bold' }}>Batal</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.manageItem}>
      <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
        {item.image ? (
          <Image source={{ uri: item.image }} style={{ width: 50, height: 50, borderRadius: 8, marginRight: 10 }} />
        ) : (
          <View style={{ width: 50, height: 50, borderRadius: 8, backgroundColor: '#f0f0f0', marginRight: 10, alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ fontSize: 22 }}>🍽️</Text>
          </View>
        )}
        <View style={{ flex: 1 }}>
          <Text style={{ fontWeight: 'bold', fontSize: 14 }}>{item.name}</Text>
          <Text style={{ fontSize: 13 }}>{formatRupiah(item.price)} {item.category ? `(${item.category})` : ''}</Text>
          {item.barcode ? <Text style={{ fontSize: 11, color: '#888' }}>Kode: {item.barcode}</Text> : null}
        </View>
      </View>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <TouchableOpacity onPress={() => setEditing(true)} style={{ padding: 8 }}>
          <Text style={{ fontSize: 18 }}>✏️</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => {
            Alert.alert('Hapus', 'Hapus produk ini?', [
              { text: 'Batal', style: 'cancel' },
              { text: 'Hapus', onPress: () => onDelete(item.id), style: 'destructive' },
            ]);
          }}
          style={{ padding: 8 }}
        >
          <Text style={{ fontSize: 18 }}>🗑️</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

export default function App() {
  const [tab, setTab] = useState('kasir');
  const [menu, setMenu] = useState(DEFAULT_MENU);
  const [cart, setCart] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [discountPercent, setDiscountPercent] = useState(0);
  const [taxPercent, setTaxPercent] = useState(0);
  const [cashReceived, setCashReceived] = useState(0);
  const [search, setSearch] = useState('');
  const [showStruk, setShowStruk] = useState(false);
  const [lastTransaction, setLastTransaction] = useState(null);
  const [showScanner, setShowScanner] = useState(false);
  const [scanned, setScanned] = useState(false);

  const [menuName, setMenuName] = useState('');
  const [menuPrice, setMenuPrice] = useState('');
  const [menuCategory, setMenuCategory] = useState('');
  const [menuBarcode, setMenuBarcode] = useState('');
  const [menuImage, setMenuImage] = useState(null);

  // Printer state
  const [printerDevices, setPrinterDevices] = useState([]);
  const [showPrinterModal, setShowPrinterModal] = useState(false);
  const [connectedPrinter, setConnectedPrinter] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const storedMenu = await AsyncStorage.getItem('@pos_menu');
        const storedTransactions = await AsyncStorage.getItem('@pos_transactions');
        if (storedMenu) setMenu(JSON.parse(storedMenu));
        if (storedTransactions) setTransactions(JSON.parse(storedTransactions));
      } catch (e) { console.log(e); }
    })();
  }, []);

  useEffect(() => { AsyncStorage.setItem('@pos_menu', JSON.stringify(menu)); }, [menu]);
  useEffect(() => { AsyncStorage.setItem('@pos_transactions', JSON.stringify(transactions)); }, [transactions]);

  const subtotal = cart.reduce((sum, item) => sum + item.price * item.qty, 0);
  const discountAmount = subtotal * discountPercent / 100;
  const afterDiscount = subtotal - discountAmount;
  const taxAmount = afterDiscount * taxPercent / 100;
  const total = afterDiscount + taxAmount;
  const change = cashReceived - total;
  const cartCount = cart.reduce((s, i) => s + i.qty, 0);

  const addProduct = (product) => setMenu([...menu, { ...product, id: Date.now() }]);
  const updateProduct = (id, data) => setMenu(menu.map(i => i.id === id ? { ...i, ...data } : i));
  const deleteProduct = (id) => setMenu(menu.filter(i => i.id !== id));
  const resetMenu = () => setMenu(DEFAULT_MENU);

  const pickImage = async (source) => {
    try {
      let result;
      if (source === 'camera') {
        const { status } = await ImagePicker.requestCameraPermissionsAsync();
        if (status !== 'granted') { Alert.alert('Izin ditolak', 'Butuh izin kamera.'); return null; }
        result = await ImagePicker.launchCameraAsync({ allowsEditing: true, aspect: [1, 1], quality: 0.5, base64: true });
      } else {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') { Alert.alert('Izin ditolak', 'Butuh izin galeri.'); return null; }
        result = await ImagePicker.launchImageLibraryAsync({ allowsEditing: true, aspect: [1, 1], quality: 0.5, base64: true });
      }
      if (!result.canceled && result.assets && result.assets[0]) {
        return `data:image/jpeg;base64,${result.assets[0].base64}`;
      }
      return null;
    } catch (e) {
      Alert.alert('Error', 'Gagal ambil gambar');
      return null;
    }
  };

  const addToCart = (product) => {
    setCart(prev => {
      const exist = prev.find(i => i.id === product.id);
      if (exist) return prev.map(i => i.id === product.id ? { ...i, qty: i.qty + 1 } : i);
      return [...prev, { ...product, qty: 1 }];
    });
  };

  const updateQty = (id, delta) => {
    setCart(prev => prev.map(i => i.id === id ? { ...i, qty: i.qty + delta } : i).filter(i => i.qty > 0));
  };

  const removeFromCart = (id) => setCart(prev => prev.filter(i => i.id !== id));

  const clearCart = () => {
    setCart([]);
    setDiscountPercent(0);
    setTaxPercent(0);
    setCashReceived(0);
  };

  const processPayment = () => {
    if (cart.length === 0) { Alert.alert('Peringatan', 'Keranjang masih kosong!'); return; }
    if (cashReceived < total) { Alert.alert('Peringatan', 'Uang tunai kurang!'); return; }
    const tr = {
      id: Date.now(),
      timestamp: new Date().toLocaleString('id-ID'),
      items: cart.map(i => ({ ...i })),
      subtotal, discountPercent, taxPercent, total, cashReceived, change,
    };
    setTransactions([...transactions, tr]);
    setLastTransaction(tr);
    setShowStruk(true);
    clearCart();
  };

  // ================== PRINTER BLUETOOTH ==================
  const scanPrinters = async () => {
    try {
      const paired = await BluetoothManager.getPairedDevices();
      if (!paired || paired.length === 0) {
        Alert.alert('Tidak ada printer', 'Pair dulu printer di setting Bluetooth HP.');
        return;
      }
      setPrinterDevices(paired);
      setShowPrinterModal(true);
    } catch (e) {
      Alert.alert('Error', 'Gagal scan printer: ' + e.message);
    }
  };

  const connectPrinter = async (device) => {
    try {
      await BluetoothManager.connectPrinter(device.inner_mac_address);
      setConnectedPrinter(device);
      setShowPrinterModal(false);
      Alert.alert('Terhubung', 'Printer: ' + device.device_name);
    } catch (e) {
      Alert.alert('Gagal', 'Tidak bisa connect: ' + e.message);
    }
  };

  const printToBluetooth = async () => {
    if (!lastTransaction) return;
    if (!connectedPrinter) {
      Alert.alert('Printer belum terhubung', 'Silakan pilih printer dulu di menu Pengaturan.');
      return;
    }
    try {
      await BluetoothEscposPrinter.printerInit();
      await BluetoothEscposPrinter.printerAlign(BluetoothEscposPrinter.ALIGN.CENTER);
      await BluetoothEscposPrinter.printText('TALIWANG HQ\n', { widthtimes: 2, heigthtimes: 2 });
      await BluetoothEscposPrinter.printText('Jl. Cendrawasih No. 88\n', {});
      await BluetoothEscposPrinter.printText('------------------------------\n', {});
      await BluetoothEscposPrinter.printerAlign(BluetoothEscposPrinter.ALIGN.LEFT);
      await BluetoothEscposPrinter.printText('Waktu: ' + lastTransaction.timestamp + '\n', {});
      await BluetoothEscposPrinter.printText('------------------------------\n', {});
      for (const item of lastTransaction.items) {
        await BluetoothEscposPrinter.printText(
          item.name + ' x' + item.qty + '  ' + formatRupiah(item.price * item.qty) + '\n',
          {}
        );
      }
      await BluetoothEscposPrinter.printText('------------------------------\n', {});
      await BluetoothEscposPrinter.printText('Subtotal: ' + formatRupiah(lastTransaction.subtotal) + '\n', {});
      if (lastTransaction.discountAmount > 0) {
        await BluetoothEscposPrinter.printText('Diskon: -' + formatRupiah(lastTransaction.discountAmount) + '\n', {});
      }
      if (lastTransaction.taxAmount > 0) {
        await BluetoothEscposPrinter.printText('Pajak: ' + formatRupiah(lastTransaction.taxAmount) + '\n', {});
      }
      await BluetoothEscposPrinter.printText('TOTAL: ' + formatRupiah(lastTransaction.total) + '\n', {});
      await BluetoothEscposPrinter.printText('Bayar: ' + formatRupiah(lastTransaction.cashReceived) + '\n', {});
      await BluetoothEscposPrinter.printText('Kembali: ' + formatRupiah(lastTransaction.change) + '\n', {});
      await BluetoothEscposPrinter.printText('------------------------------\n', {});
      await BluetoothEscposPrinter.printerAlign(BluetoothEscposPrinter.ALIGN.CENTER);
      await BluetoothEscposPrinter.printText('Terima kasih!\n\n\n', {});
      await BluetoothEscposPrinter.cutPaper();
      Alert.alert('Sukses', 'Struk sedang dicetak.');
    } catch (e) {
      Alert.alert('Gagal cetak', e.message);
    }
  };

  const printToPDF = async () => {
    if (!lastTransaction) return;
    const html = `
      <html><body style="font-family: monospace; width: 80mm; padding: 10px;">
        <h2 style="text-align:center; margin:0;">TALIWANG HQ</h2>
        <p style="text-align:center; margin:4px 0;">Jl. Cendrawasih No. 88, Mataram</p>
        <hr />
        <p>Waktu: ${lastTransaction.timestamp}</p>
        <hr />
        ${lastTransaction.items.map(i => `<p>${i.name} x${i.qty} = ${formatRupiah(i.price * i.qty)}</p>`).join('')}
        <hr />
        <p>Subtotal: ${formatRupiah(lastTransaction.subtotal)}</p>
        ${lastTransaction.discountAmount > 0 ? `<p>Diskon: -${formatRupiah(lastTransaction.discountAmount)}</p>` : ''}
        ${lastTransaction.taxAmount > 0 ? `<p>Pajak: ${formatRupiah(lastTransaction.taxAmount)}</p>` : ''}
        <p style="font-weight:bold;font-size:16px;">TOTAL: ${formatRupiah(lastTransaction.total)}</p>
        <p>Bayar: ${formatRupiah(lastTransaction.cashReceived)}</p>
        <p>Kembali: ${formatRupiah(lastTransaction.change)}</p>
        <hr />
        <p style="text-align:center;">Terima kasih!</p>
      </body></html>
    `;
    try {
      const { uri } = await Print.printToFileAsync({ html });
      await Sharing.shareAsync(uri, { mimeType: 'application/pdf', dialogTitle: 'Bagikan struk' });
    } catch (e) {
      Alert.alert('Gagal', e.message);
    }
  };

  const shareStruk = async () => {
    if (!lastTransaction) return;
    const text = 'Taliwang HQ\n------------------------------\nWaktu: ' + lastTransaction.timestamp +
      '\n------------------------------\n' +
      lastTransaction.items.map(i => `${i.name} x${i.qty} = ${formatRupiah(i.price * i.qty)}`).join('\n') +
      '\n------------------------------\n' +
      'Subtotal: ' + formatRupiah(lastTransaction.subtotal) +
      '\nDiskon: -' + formatRupiah(lastTransaction.discountAmount) +
      '\nPajak: ' + formatRupiah(lastTransaction.taxAmount) +
      '\nTOTAL: ' + formatRupiah(lastTransaction.total) +
      '\nBayar: ' + formatRupiah(lastTransaction.cashReceived) +
      '\nKembali: ' + formatRupiah(lastTransaction.change) +
      '\n------------------------------\nTerima kasih!';
    try { await Share.share({ message: text }); } catch (e) { console.log(e); }
  };

  const openScanner = async () => {
    const { status } = await BarCodeScanner.requestPermissionsAsync();
    if (status !== 'granted') { Alert.alert('Izin ditolak', 'Butuh izin kamera.'); return; }
    setScanned(false);
    setShowScanner(true);
  };

  const handleBarCodeScanned = ({ data }) => {
    if (scanned) return;
    setScanned(true);
    const product = menu.find(p => p.barcode === data);
    if (product) {
      addToCart(product);
      Alert.alert('Berhasil', product.name + ' ditambahkan ke keranjang.');
    } else {
      Alert.alert('Tidak ditemukan', 'Kode ' + data + ' tidak terdaftar.');
    }
    setShowScanner(false);
    setScanned(false);
  };

  // ================== RENDER ==================
  const renderKasir = () => {
    const filtered = menu.filter(i =>
      i.name.toLowerCase().includes(search.toLowerCase()) ||
      (i.category && i.category.toLowerCase().includes(search.toLowerCase())) ||
      (i.barcode && i.barcode.includes(search))
    );
    return (
      <View style={styles.container}>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <TextInput
            style={styles.searchInput}
            placeholder="Cari menu..."
            value={search}
            onChangeText={setSearch}
          />
          <TouchableOpacity style={styles.scanBtn} onPress={openScanner}>
            <Text style={{ color: '#fff', fontWeight: 'bold' }}>📷</Text>
          </TouchableOpacity>
        </View>

        <FlatList
          data={filtered}
          keyExtractor={(i) => i.id.toString()}
          renderItem={({ item }) => (
            <TouchableOpacity style={styles.productCard} onPress={() => addToCart(item)}>
              {item.image ? (
                <Image source={{ uri: item.image }} style={styles.productImg} />
              ) : (
                <View style={styles.productImgPlaceholder}>
                  <Text style={{ fontSize: 30 }}>🍽️</Text>
                </View>
              )}
              <Text style={styles.productName} numberOfLines={2}>{item.name}</Text>
              <Text style={styles.productPrice}>{formatRupiah(item.price)}</Text>
            </TouchableOpacity>
          )}
          numColumns={3}
          columnWrapperStyle={{ justifyContent: 'space-between' }}
          style={{ flex: 1, marginBottom: 8 }}
        />

        <View style={styles.cartPanel}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text style={styles.sectionTitle}>Pesanan ({cartCount})</Text>
            {cart.length > 0 && (
              <TouchableOpacity onPress={clearCart}>
                <Text style={{ color: '#d32f2f', fontSize: 12, fontWeight: 'bold' }}>Kosongkan</Text>
              </TouchableOpacity>
            )}
          </View>

          <ScrollView style={{ maxHeight: 100 }}>
            {cart.length === 0 ? (
              <Text style={{ textAlign: 'center', color: '#999', paddingVertical: 6, fontSize: 12 }}>Keranjang kosong</Text>
            ) : (
              cart.map(item => (
                <View key={item.id} style={styles.cartItem}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontWeight: 'bold', fontSize: 12 }}>{item.name}</Text>
                    <Text style={{ color: '#555', fontSize: 11 }}>{formatRupiah(item.price * item.qty)}</Text>
                  </View>
                  <View style={styles.qtyControls}>
                    <TouchableOpacity onPress={() => updateQty(item.id, -1)} style={styles.qtyBtn}>
                      <Text>−</Text>
                    </TouchableOpacity>
                    <Text style={{ fontWeight: 'bold', minWidth: 18, textAlign: 'center', fontSize: 13 }}>{item.qty}</Text>
                    <TouchableOpacity onPress={() => updateQty(item.id, 1)} style={styles.qtyBtn}>
                      <Text>+</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => removeFromCart(item.id)} style={{ padding: 4 }}>
                      <Text>✕</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ))
            )}
          </ScrollView>

          <View style={{ flexDirection: 'row', gap: 8, marginTop: 6 }}>
            <TextInput
              style={styles.smallInput}
              placeholder="Diskon %"
              keyboardType="numeric"
              value={discountPercent.toString()}
              onChangeText={(t) => setDiscountPercent(parseFloat(t) || 0)}
            />
            <TextInput
              style={styles.smallInput}
              placeholder="Pajak %"
              keyboardType="numeric"
              value={taxPercent.toString()}
              onChangeText={(t) => setTaxPercent(parseFloat(t) || 0)}
            />
          </View>

          <View style={{ marginVertical: 4 }}>
            <Text style={{ fontSize: 11, color: '#666' }}>
              Subtotal: {formatRupiah(subtotal)} | Diskon: -{formatRupiah(discountAmount)} | Pajak: {formatRupiah(taxAmount)}
            </Text>
            <Text style={{ fontWeight: 'bold', fontSize: 16, color: '#2e7d32' }}>Total: {formatRupiah(total)}</Text>
          </View>

          <TextInput
            style={styles.cashInput}
            placeholder="Uang tunai diterima"
            keyboardType="numeric"
            value={cashReceived.toString()}
            onChangeText={(t) => setCashReceived(parseFloat(t) || 0)}
          />

          <Text style={{ fontWeight: 'bold', fontSize: 13, marginBottom: 6 }}>
            Kembalian: {formatRupiah(Math.max(change, 0))}
          </Text>

          <TouchableOpacity style={styles.payBtn} onPress={processPayment}>
            <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 14 }}>💵 Bayar & Cetak</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  const renderRiwayat = () => (
    <View style={styles.container}>
      <Text style={styles.sectionTitle}>Riwayat Transaksi</Text>
      {transactions.length === 0 ? (
        <Text style={{ textAlign: 'center', color: '#999', marginTop: 50 }}>Belum ada transaksi</Text>
      ) : (
        <FlatList
          data={transactions.slice().reverse()}
          keyExtractor={(i) => i.id.toString()}
          renderItem={({ item }) => (
            <View style={styles.historyCard}>
              <Text style={{ fontWeight: 'bold', fontSize: 13 }}>{item.timestamp}</Text>
              <Text style={{ fontSize: 12, marginTop: 4 }}>
                {item.items.map(i => `${i.name} x${i.qty}`).join(', ')}
              </Text>
              <Text style={{ fontSize: 13, fontWeight: 'bold', color: '#2e7d32', marginTop: 4 }}>
                Total: {formatRupiah(item.total)}
              </Text>
              <Text style={{ fontSize: 11, color: '#666' }}>
                Bayar: {formatRupiah(item.cashReceived)} | Kembali: {formatRupiah(item.change)}
              </Text>
            </View>
          )}
        />
      )}
    </View>
  );

  const renderMenuManage = () => {
    const handleAdd = () => {
      if (!menuName || !menuPrice || isNaN(parseFloat(menuPrice))) {
        Alert.alert('Error', 'Nama dan harga wajib diisi!');
        return;
      }
      addProduct({
        name: menuName,
        price: parseFloat(menuPrice),
        category: menuCategory,
        barcode: menuBarcode,
        image: menuImage
      });
      setMenuName(''); setMenuPrice(''); setMenuCategory(''); setMenuBarcode(''); setMenuImage(null);
    };

    const handleImage = async (src) => {
      const img = await pickImage(src);
      if (img) setMenuImage(img);
    };

    return (
      <View style={styles.container}>
        <Text style={styles.sectionTitle}>Manajemen Menu</Text>
        <TextInput placeholder="Nama Produk" value={menuName} onChangeText={setMenuName} style={styles.input} />
        <TextInput placeholder="Harga" value={menuPrice} onChangeText={setMenuPrice} keyboardType="numeric" style={styles.input} />
        <TextInput placeholder="Kategori (opsional)" value={menuCategory} onChangeText={setMenuCategory} style={styles.input} />
        <TextInput placeholder="Barcode (opsional)" value={menuBarcode} onChangeText={setMenuBarcode} style={styles.input} />
        <View style={{ flexDirection: 'row', gap: 8, marginBottom: 8 }}>
          <TouchableOpacity style={styles.imgBtn} onPress={() => handleImage('library')}>
            <Text style={{ fontSize: 12 }}>🖼️ Galeri</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.imgBtn} onPress={() => handleImage('camera')}>
            <Text style={{ fontSize: 12 }}>📷 Kamera</Text>
          </TouchableOpacity>
        </View>
        {menuImage ? <Image source={{ uri: menuImage }} style={{ width: 100, height: 100, borderRadius: 8, marginBottom: 8 }} /> : null}
        <TouchableOpacity style={styles.payBtn} onPress={handleAdd}>
          <Text style={{ color: '#fff', fontWeight: 'bold' }}>+ Tambah Produk</Text>
        </TouchableOpacity>

        <Text style={[styles.sectionTitle, { marginTop: 16 }]}>Pengaturan Printer</Text>
        <View style={{ backgroundColor: '#fff', padding: 12, borderRadius: 8, marginBottom: 12 }}>
          <Text style={{ fontSize: 13, marginBottom: 8 }}>
            Status: {connectedPrinter ? '🟢 ' + connectedPrinter.device_name : '🔴 Belum terhubung'}
          </Text>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <TouchableOpacity style={[styles.imgBtn, { backgroundColor: '#1976d2' }]} onPress={scanPrinters}>
              <Text style={{ color: '#fff', fontSize: 12, fontWeight: 'bold' }}>🔗 Cari Printer</Text>
            </TouchableOpacity>
            {connectedPrinter && (
              <TouchableOpacity
                style={[styles.imgBtn, { backgroundColor: '#d32f2f' }]}
                onPress={() => { setConnectedPrinter(null); Alert.alert('Terputus', 'Printer diputus.'); }}
              >
                <Text style={{ color: '#fff', fontSize: 12, fontWeight: 'bold' }}>❌ Putuskan</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        <TouchableOpacity
          style={styles.clearBtn}
          onPress={() => {
            Alert.alert('Reset', 'Yakin reset menu ke default?', [
              { text: 'Batal', style: 'cancel' },
              { text: 'Reset', onPress: resetMenu, style: 'destructive' },
            ]);
          }}
        >
          <Text style={{ fontSize: 12 }}>Reset Menu ke Default</Text>
        </TouchableOpacity>

        <FlatList
          data={menu}
          keyExtractor={(i) => i.id.toString()}
          renderItem={({ item }) => (
            <MenuManageItem item={item} onUpdate={updateProduct} onDelete={deleteProduct} pickImg={pickImage} />
          )}
          style={{ marginTop: 12 }}
        />
      </View>
    );
  };

  const renderScanner = () => (
    <Modal visible={showScanner} animationType="slide">
      <View style={{ flex: 1, backgroundColor: '#000' }}>
        {Platform.OS === 'web' ? (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ color: '#fff' }}>Scanner tidak didukung di web.</Text>
            <TouchableOpacity onPress={() => setShowScanner(false)} style={{ marginTop: 20 }}>
              <Text style={{ color: '#fff', fontWeight: 'bold' }}>Tutup</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={{ flex: 1 }}>
            <BarCodeScanner
              onBarCodeScanned={scanned ? undefined : handleBarCodeScanned}
              style={StyleSheet.absoluteFillObject}
            />
            <View style={{ position: 'absolute', bottom: 50, left: 20, right: 20, alignItems: 'center' }}>
              <Text style={{ color: '#fff', fontWeight: 'bold', marginBottom: 15 }}>Arahkan kamera ke barcode</Text>
              <TouchableOpacity
                onPress={() => setShowScanner(false)}
                style={{ backgroundColor: '#d32f2f', paddingVertical: 12, paddingHorizontal: 40, borderRadius: 30 }}
              >
                <Text style={{ color: '#fff', fontWeight: 'bold' }}>Tutup</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </View>
    </Modal>
  );

  const renderPrinterModal = () => (
    <Modal visible={showPrinterModal} animationType="slide" transparent>
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <Text style={{ fontSize: 16, fontWeight: 'bold', marginBottom: 10 }}>Pilih Printer</Text>
          <ScrollView style={{ maxHeight: 300 }}>
            {printerDevices.map((d) => (
              <TouchableOpacity
                key={d.inner_mac_address}
                style={{ padding: 12, borderBottomWidth: 1, borderBottomColor: '#eee' }}
                onPress={() => connectPrinter(d)}
              >
                <Text style={{ fontWeight: 'bold' }}>🖨️ {d.device_name}</Text>
                <Text style={{ fontSize: 11, color: '#888' }}>{d.inner_mac_address}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
          <TouchableOpacity
            style={[styles.modalBtn, { backgroundColor: '#d32f2f', marginTop: 10 }]}
            onPress={() => setShowPrinterModal(false)}
          >
            <Text style={{ color: '#fff', fontWeight: 'bold' }}>Tutup</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );

  const renderStruk = () => (
    <Modal visible={showStruk} animationType="slide" transparent>
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <Text style={{ fontSize: 18, fontWeight: 'bold', textAlign: 'center' }}>Taliwang HQ</Text>
          <Text style={{ textAlign: 'center', fontSize: 12 }}>Jl. Cendrawasih No. 88, Mataram</Text>
          <View style={{ borderWidth: 0.5, borderColor: '#ccc', marginVertical: 8 }} />
          <Text style={{ fontSize: 12 }}>Waktu: {lastTransaction ? lastTransaction.timestamp : '-'}</Text>
          <View style={{ borderWidth: 0.5, borderColor: '#ccc', marginVertical: 8 }} />
          {lastTransaction && lastTransaction.items.map((item, i) => (
            <Text key={i} style={{ fontSize: 12 }}>
              {item.name} x{item.qty} = {formatRupiah(item.price * item.qty)}
            </Text>
          ))}
          <View style={{ borderWidth: 0.5, borderColor: '#ccc', marginVertical: 8 }} />
          <Text style={{ fontSize: 12 }}>Subtotal: {formatRupiah(lastTransaction ? lastTransaction.subtotal : 0)}</Text>
          {lastTransaction && lastTransaction.discountPercent > 0 && (
            <Text style={{ fontSize: 12 }}>Diskon: -{formatRupiah(lastTransaction.discountAmount)}</Text>
          )}
          {lastTransaction && lastTransaction.taxPercent > 0 && (
            <Text style={{ fontSize: 12 }}>Pajak: {formatRupiah(lastTransaction.taxAmount)}</Text>
          )}
          <Text style={{ fontWeight: 'bold', fontSize: 15, marginTop: 4 }}>
            Total: {formatRupiah(lastTransaction ? lastTransaction.total : 0)}
          </Text>
          <Text style={{ fontSize: 12 }}>Bayar: {formatRupiah(lastTransaction ? lastTransaction.cashReceived : 0)}</Text>
          <Text style={{ fontSize: 12 }}>Kembali: {formatRupiah(lastTransaction ? lastTransaction.change : 0)}</Text>
          <View style={{ borderWidth: 0.5, borderColor: '#ccc', marginVertical: 8 }} />
          <Text style={{ textAlign: 'center', fontSize: 12 }}>Terima kasih!</Text>

          <View style={{ flexDirection: 'row', gap: 6, marginTop: 12 }}>
            <TouchableOpacity style={[styles.modalBtn, { backgroundColor: '#1976d2' }]} onPress={printToBluetooth}>
              <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 12 }}>🖨️ Cetak BT</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.modalBtn, { backgroundColor: '#f57c00' }]} onPress={printToPDF}>
              <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 12 }}>📄 PDF</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.modalBtn, { backgroundColor: '#25D366' }]} onPress={shareStruk}>
              <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 12 }}>💬 WA</Text>
            </TouchableOpacity>
          </View>
          <TouchableOpacity style={[styles.modalBtn, { backgroundColor: '#eee', marginTop: 6 }]} onPress={() => setShowStruk(false)}>
            <Text style={{ fontWeight: 'bold' }}>Tutup</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#f4f6f9' }}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.header}>
          <Text style={styles.appTitle}>🧾 Kasir Taliwang</Text>
          <View style={styles.tabs}>
            <TouchableOpacity style={[styles.tabBtn, tab === 'kasir' && styles.tabActive]} onPress={() => setTab('kasir')}>
              <Text style={{ color: tab === 'kasir' ? '#fff' : '#333', fontSize: 11, fontWeight: 'bold' }}>🛒 Kasir</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.tabBtn, tab === 'riwayat' && styles.tabActive]} onPress={() => setTab('riwayat')}>
              <Text style={{ color: tab === 'riwayat' ? '#fff' : '#333', fontSize: 11, fontWeight: 'bold' }}>📋 Riwayat</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.tabBtn, tab === 'menu' && styles.tabActive]} onPress={() => setTab('menu')}>
              <Text style={{ color: tab === 'menu' ? '#fff' : '#333', fontSize: 11, fontWeight: 'bold' }}>⚙️ Menu</Text>
            </TouchableOpacity>
          </View>
        </View>

        {tab === 'kasir' && renderKasir()}
        {tab === 'riwayat' && renderRiwayat()}
        {tab === 'menu' && renderMenuManage()}

        {renderStruk()}
        {renderScanner()}
        {renderPrinterModal()}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 10, paddingVertical: 8, backgroundColor: '#fff',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1, shadowRadius: 4, elevation: 3,
  },
  appTitle: { fontSize: 15, fontWeight: 'bold', color: '#2e7d32' },
  tabs: { flexDirection: 'row', gap: 4 },
  tabBtn: { paddingVertical: 6, paddingHorizontal: 8, borderRadius: 20, backgroundColor: '#eee' },
  tabActive: { backgroundColor: '#2e7d32' },
  container: { flex: 1, padding: 8 },
  searchInput: {
    flex: 1, backgroundColor: '#fff', borderRadius: 30, paddingHorizontal: 14, paddingVertical: 10,
    borderWidth: 1, borderColor: '#ddd', fontSize: 13,
  },
  scanBtn: {
    backgroundColor: '#1976d2', paddingHorizontal: 16, borderRadius: 30,
    justifyContent: 'center', alignItems: 'center',
  },
  productCard: {
    flex: 1, backgroundColor: '#fff', borderRadius: 10, padding: 6, margin: 3,
    alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08, shadowRadius: 3, elevation: 2,
  },
  productImg: { width: '100%', aspectRatio: 1, borderRadius: 6, marginBottom: 4 },
  productImgPlaceholder: {
    width: '100%', aspectRatio: 1, backgroundColor: '#f0f0f0',
    borderRadius: 6, marginBottom: 4, alignItems: 'center', justifyContent: 'center',
  },
  productName: { fontWeight: 'bold', textAlign: 'center', fontSize: 11, lineHeight: 14 },
  productPrice: { color: '#2e7d32', fontWeight: 'bold', fontSize: 12, marginTop: 2 },
  cartPanel: {
    backgroundColor: '#fff', borderRadius: 12, padding: 10, marginTop: 4,
    maxHeight: '48%', borderTopWidth: 2, borderTopColor: '#2e7d32',
  },
  sectionTitle: { fontSize: 14, fontWeight: 'bold', marginBottom: 6 },
  cartItem: {
    flexDirection: 'row', alignItems: 'center', paddingVertical: 4,
    borderBottomWidth: 1, borderBottomColor: '#eee',
  },
  qtyControls: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  qtyBtn: {
    width: 24, height: 24, borderRadius: 12, backgroundColor: '#eee',
    alignItems: 'center', justifyContent: 'center',
  },
  smallInput: {
    flex: 1, borderWidth: 1, borderColor: '#ddd', borderRadius: 6,
    paddingHorizontal: 8, paddingVertical: 6, fontSize: 12,
  },
  cashInput: {
    borderWidth: 1, borderColor: '#ddd', borderRadius: 6,
    paddingHorizontal: 10, paddingVertical: 8, marginTop: 4, marginBottom: 4, fontSize: 13,
  },
  payBtn: {
    backgroundColor: '#2e7d32', paddingVertical: 12, borderRadius: 8,
    alignItems: 'center', marginTop: 4,
  },
  clearBtn: {
    paddingVertical: 8, alignItems: 'center', backgroundColor: '#eee',
    borderRadius: 8, marginTop: 6,
  },
  historyCard: { backgroundColor: '#fff', padding: 12, borderRadius: 10, marginBottom: 8 },
  input: {
    borderWidth: 1, borderColor: '#ddd', borderRadius: 8,
    paddingHorizontal: 10, paddingVertical: 8, marginBottom: 6, backgroundColor: '#fff', fontSize: 13,
  },
  manageItem: { backgroundColor: '#fff', padding: 10, borderRadius: 8, marginBottom: 8 },
  imgBtn: { flex: 1, backgroundColor: '#eee', paddingVertical: 8, borderRadius: 6, alignItems: 'center' },
  smallBtn: { padding: 8, borderRadius: 6, alignItems: 'center', flex: 1 },
  modalOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center', justifyContent: 'center', padding: 20,
  },
  modalContent: { width: '100%', maxWidth: 400, backgroundColor: '#fff', borderRadius: 12, padding: 20 },
  modalBtn: { flex: 1, padding: 12, borderRadius: 8, alignItems: 'center' },
});
