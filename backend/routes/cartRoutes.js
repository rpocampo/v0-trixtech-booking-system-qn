const express = require('express');
const { authMiddleware } = require('../middleware/auth');
const Cart = require('../models/Cart');
const Service = require('../models/Service');
const { auditService } = require('../utils/auditService');

const router = express.Router();

// Get user's cart
router.get('/', authMiddleware, async (req, res, next) => {
  try {
    const cart = await Cart.getOrCreateCart(req.user.id)
      .populate('items.serviceId', 'name price category serviceType quantity isAvailable image');

    res.json({
      success: true,
      cart: {
        items: cart.items,
        totalItems: cart.totalItems,
        totalPrice: cart.totalPrice,
        lastActivity: cart.lastActivity
      }
    });
  } catch (error) {
    next(error);
  }
});

// Add item to cart
router.post('/items', authMiddleware, async (req, res, next) => {
  try {
    const { serviceId, quantity = 1 } = req.body;

    if (!serviceId) {
      return res.status(400).json({ success: false, message: 'Service ID is required' });
    }

    // Validate service exists and is available
    const service = await Service.findById(serviceId);
    if (!service) {
      return res.status(404).json({ success: false, message: 'Service not found' });
    }

    if (!service.isAvailable) {
      return res.status(400).json({ success: false, message: 'Service is not available' });
    }

    const cart = await Cart.getOrCreateCart(req.user.id);
    await cart.addItem(serviceId, quantity);

    // Populate the updated cart
    await cart.populate('items.serviceId', 'name price category serviceType quantity isAvailable image');

    // Log audit event
    await auditService.logEvent(
      'add_to_cart',
      req.user.id,
      {
        serviceId,
        serviceName: service.name,
        quantity,
        cartTotalItems: cart.totalItems,
        cartTotalPrice: cart.totalPrice,
        ip: req.ip,
        userAgent: req.get('User-Agent')
      }
    );

    res.json({
      success: true,
      cart: {
        items: cart.items,
        totalItems: cart.totalItems,
        totalPrice: cart.totalPrice
      }
    });
  } catch (error) {
    next(error);
  }
});

// Update item quantity in cart
router.put('/items/:serviceId', authMiddleware, async (req, res, next) => {
  try {
    const { serviceId } = req.params;
    const { quantity } = req.body;

    if (quantity < 0) {
      return res.status(400).json({ success: false, message: 'Quantity cannot be negative' });
    }

    const cart = await Cart.getOrCreateCart(req.user.id);
    await cart.updateItemQuantity(serviceId, quantity);

    // Populate the updated cart
    await cart.populate('items.serviceId', 'name price category serviceType quantity isAvailable image');

    // Log audit event
    await auditService.logEvent(
      quantity === 0 ? 'remove_from_cart' : 'update_cart_quantity',
      req.user.id,
      {
        serviceId,
        newQuantity: quantity,
        cartTotalItems: cart.totalItems,
        cartTotalPrice: cart.totalPrice,
        ip: req.ip,
        userAgent: req.get('User-Agent')
      }
    );

    res.json({
      success: true,
      cart: {
        items: cart.items,
        totalItems: cart.totalItems,
        totalPrice: cart.totalPrice
      }
    });
  } catch (error) {
    next(error);
  }
});

// Remove item from cart
router.delete('/items/:serviceId', authMiddleware, async (req, res, next) => {
  try {
    const { serviceId } = req.params;

    const cart = await Cart.getOrCreateCart(req.user.id);
    await cart.removeItem(serviceId);

    // Populate the updated cart
    await cart.populate('items.serviceId', 'name price category serviceType quantity isAvailable image');

    // Log audit event
    await auditService.logEvent(
      'remove_from_cart',
      req.user.id,
      {
        serviceId,
        cartTotalItems: cart.totalItems,
        cartTotalPrice: cart.totalPrice,
        ip: req.ip,
        userAgent: req.get('User-Agent')
      }
    );

    res.json({
      success: true,
      cart: {
        items: cart.items,
        totalItems: cart.totalItems,
        totalPrice: cart.totalPrice
      }
    });
  } catch (error) {
    next(error);
  }
});

// Clear entire cart
router.delete('/', authMiddleware, async (req, res, next) => {
  try {
    const cart = await Cart.getOrCreateCart(req.user.id);
    const oldTotalItems = cart.totalItems;
    const oldTotalPrice = cart.totalPrice;

    await cart.clearCart();

    // Log audit event
    await auditService.logEvent(
      'clear_cart',
      req.user.id,
      {
        previousTotalItems: oldTotalItems,
        previousTotalPrice: oldTotalPrice,
        ip: req.ip,
        userAgent: req.get('User-Agent')
      }
    );

    res.json({
      success: true,
      cart: {
        items: [],
        totalItems: 0,
        totalPrice: 0
      }
    });
  } catch (error) {
    next(error);
  }
});

// Validate cart stock availability
router.get('/validate-stock', authMiddleware, async (req, res, next) => {
  try {
    const cart = await Cart.getOrCreateCart(req.user.id);
    const validation = await cart.validateStock();

    res.json({
      success: true,
      validation
    });
  } catch (error) {
    next(error);
  }
});

// Sync cart with localStorage (for migration from frontend-only cart)
router.post('/sync', authMiddleware, async (req, res, next) => {
  try {
    const { items } = req.body;

    if (!Array.isArray(items)) {
      return res.status(400).json({ success: false, message: 'Items array is required' });
    }

    const cart = await Cart.getOrCreateCart(req.user.id);

    // Clear existing items
    cart.items = [];

    // Add new items
    for (const item of items) {
      if (item.id && item.quantity > 0) {
        cart.items.push({
          serviceId: item.id,
          quantity: item.quantity,
          addedAt: new Date(),
          lastUpdated: new Date()
        });
      }
    }

    await cart.save();
    await cart.populate('items.serviceId', 'name price category serviceType quantity isAvailable image');

    // Log audit event
    await auditService.logEvent(
      'sync_cart',
      req.user.id,
      {
        syncedItemsCount: items.length,
        cartTotalItems: cart.totalItems,
        cartTotalPrice: cart.totalPrice,
        ip: req.ip,
        userAgent: req.get('User-Agent')
      }
    );

    res.json({
      success: true,
      cart: {
        items: cart.items,
        totalItems: cart.totalItems,
        totalPrice: cart.totalPrice
      }
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;