const express = require('express');
const Service = require('../models/Service');
const { authMiddleware, adminMiddleware } = require('../middleware/auth');

const router = express.Router();

// Get all services
router.get('/', async (req, res, next) => {
  try {
    const services = await Service.find({ isAvailable: true });
    res.json({ success: true, services });
  } catch (error) {
    next(error);
  }
});

// Get service by ID
router.get('/:id', async (req, res, next) => {
  try {
    const service = await Service.findById(req.params.id);
    if (!service) {
      return res.status(404).json({ success: false, message: 'Service not found' });
    }
    res.json({ success: true, service });
  } catch (error) {
    next(error);
  }
});

// Create service (admin only)
router.post('/', adminMiddleware, async (req, res, next) => {
  try {
    const { name, description, category, price, duration, image } = req.body;

    const service = new Service({
      name,
      description,
      category,
      price,
      duration,
      image,
    });

    await service.save();
    res.status(201).json({ success: true, service });
  } catch (error) {
    next(error);
  }
});

// Update service (admin only)
router.put('/:id', adminMiddleware, async (req, res, next) => {
  try {
    const service = await Service.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });

    if (!service) {
      return res.status(404).json({ success: false, message: 'Service not found' });
    }

    res.json({ success: true, service });
  } catch (error) {
    next(error);
  }
});

// Delete service (admin only)
router.delete('/:id', adminMiddleware, async (req, res, next) => {
  try {
    const service = await Service.findByIdAndDelete(req.params.id);
    if (!service) {
      return res.status(404).json({ success: false, message: 'Service not found' });
    }
    res.json({ success: true, message: 'Service deleted' });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
